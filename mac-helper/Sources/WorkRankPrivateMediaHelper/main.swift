// WorkRankPrivateMediaHelper
//
// A deliberately small macOS menu-bar helper that turns a *global* key press
// into a Private Media command, even when Work Rank is not the focused app.
//
// Design notes
// ------------
// * Global hotkeys use Carbon `RegisterEventHotKey`, which does NOT require
//   Accessibility permissions (unlike a CGEventTap) and works while another app
//   has focus.
// * There is no local HTTP listener. The helper only ever talks *out* to the
//   Work Rank backend with a scoped device token, so no other local process can
//   drive the player through this helper.
// * The device token is stored in Application Support with 0600 permissions and
//   can be revoked server-side at any time; revocation takes effect on the very
//   next command (the backend re-checks the grant every call).

import AppKit
import Carbon.HIToolbox
import Foundation

// MARK: - Configuration

struct HelperConfig: Codable {
    var serverURL: String
    var deviceToken: String
    var deviceName: String
}

enum HelperError: Error, LocalizedError {
    case notPaired
    case badServerURL
    case http(Int, String)
    case network(String)
    case decoding

    var errorDescription: String? {
        switch self {
        case .notPaired:
            return "Thiết bị chưa được ghép nối. Tạo mã trong Work Rank → Điều khiển media → Phím tắt."
        case .badServerURL:
            return "Địa chỉ máy chủ không hợp lệ."
        case let .http(code, message):
            return "Máy chủ trả về \(code): \(message)"
        case let .network(message):
            return "Không kết nối được máy chủ: \(message)"
        case .decoding:
            return "Phản hồi từ máy chủ không đọc được."
        }
    }
}

enum ConfigStore {
    static var directoryURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        return base.appendingPathComponent("WorkRankPrivateMedia", isDirectory: true)
    }

    static var fileURL: URL {
        directoryURL.appendingPathComponent("config.json")
    }

    static func load() -> HelperConfig? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(HelperConfig.self, from: data)
    }

    static func save(_ config: HelperConfig) throws {
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(config)
        try data.write(to: fileURL, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }

    static func clear() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}

// MARK: - Backend client

final class PrivateMediaClient {
    private let config: HelperConfig
    private let session: URLSession

    init(config: HelperConfig) {
        self.config = config
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 6
        configuration.waitsForConnectivity = false
        self.session = URLSession(configuration: configuration)
    }

    private func request(path: String, body: [String: Any], token: String?) -> URLRequest? {
        guard let url = URL(string: config.serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) else {
            return nil
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue(token, forHTTPHeaderField: "X-Device-Token") }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return request
    }

    func send(action: String, completion: @escaping (Result<[String: Any], HelperError>) -> Void) {
        guard let request = request(
            path: "/api/private-media/device/commands",
            body: ["commandId": UUID().uuidString, "action": action],
            token: config.deviceToken
        ) else {
            completion(.failure(.badServerURL))
            return
        }

        session.dataTask(with: request) { data, response, error in
            if let error {
                completion(.failure(.network(error.localizedDescription)))
                return
            }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]

            if status == 200 {
                completion(.success(json))
            } else if status == 409, (json["code"] as? String) == "NO_ACTIVE_MEDIA_SESSION" {
                completion(.success(json))
            } else if status == 404 {
                // Revoked token or revoked entitlement: indistinguishable by design.
                completion(.failure(.http(404, "Thiết bị đã bị thu hồi hoặc không còn quyền.")))
            } else {
                completion(.failure(.http(status, json["message"] as? String ?? "Lỗi không xác định")))
            }
        }.resume()
    }
}

// MARK: - Pairing

enum Pairing {
    static func pair(server: String, code: String, name: String, completion: @escaping (Result<HelperConfig, HelperError>) -> Void) {
        guard let url = URL(string: server.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/private-media/devices/pair") else {
            completion(.failure(.badServerURL))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "code": code.uppercased(),
            "name": name,
            "platform": "macos",
        ])

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error {
                completion(.failure(.network(error.localizedDescription)))
                return
            }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200,
                  let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = json["deviceToken"] as? String
            else {
                completion(.failure(.http(status, "Mã ghép nối không đúng hoặc đã hết hạn.")))
                return
            }

            let config = HelperConfig(
                serverURL: server.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
                deviceToken: token,
                deviceName: name
            )
            do {
                try ConfigStore.save(config)
                completion(.success(config))
            } catch {
                completion(.failure(.network("Không ghi được cấu hình: \(error.localizedDescription)")))
            }
        }.resume()
    }
}

// MARK: - Global hotkeys (Carbon)

private var sharedHotKeys: HotKeyManager?

final class HotKeyManager {
    struct Binding {
        let id: UInt32
        let keyCode: UInt32
        let modifiers: UInt32
        let action: String
        let label: String
    }

    // F8 is the required default: play/pause.
    static let bindings: [Binding] = [
        Binding(id: 1, keyCode: UInt32(kVK_F8), modifiers: 0, action: "TOGGLE_PLAY_PAUSE", label: "F8"),
        Binding(id: 2, keyCode: UInt32(kVK_F8), modifiers: UInt32(shiftKey), action: "STOP", label: "⇧F8"),
        Binding(id: 3, keyCode: UInt32(kVK_F9), modifiers: 0, action: "NEXT", label: "F9"),
    ]

    var onTrigger: ((Binding) -> Void)?
    private var refs: [EventHotKeyRef?] = []
    private var handlerRef: EventHandlerRef?

    /// Installs the system-wide hotkeys.
    /// - Returns: how many bindings were accepted by the system (0 = failed).
    func install() -> Int {
        sharedHotKeys = self

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let status = InstallEventHandler(
            GetApplicationEventTarget(),
            { _, event, _ -> OSStatus in
                guard let event else { return OSStatus(eventNotHandledErr) }
                var hotKeyID = EventHotKeyID()
                let result = GetEventParameter(
                    event,
                    EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID),
                    nil,
                    MemoryLayout<EventHotKeyID>.size,
                    nil,
                    &hotKeyID
                )
                guard result == noErr else { return OSStatus(eventNotHandledErr) }
                sharedHotKeys?.fire(id: hotKeyID.id)
                return noErr
            },
            1,
            &eventType,
            nil,
            &handlerRef
        )

        guard status == noErr else { return 0 }

        for binding in Self.bindings {
            var ref: EventHotKeyRef?
            let hotKeyID = EventHotKeyID(signature: OSType(0x574D_4544), id: binding.id) // 'WMED'
            let registerStatus = RegisterEventHotKey(
                binding.keyCode,
                binding.modifiers,
                hotKeyID,
                GetApplicationEventTarget(),
                0,
                &ref
            )
            if registerStatus == noErr {
                refs.append(ref)
            } else {
                NSLog("[WorkRankPrivateMedia] Không đăng ký được \(binding.label) (mã \(registerStatus))")
            }
        }
        return refs.count
    }

    func uninstall() {
        for ref in refs {
            if let ref { UnregisterEventHotKey(ref) }
        }
        refs.removeAll()
        if let handlerRef { RemoveEventHandler(handlerRef) }
        handlerRef = nil
        sharedHotKeys = nil
    }

    fileprivate func fire(id: UInt32) {
        guard let binding = Self.bindings.first(where: { $0.id == id }) else { return }
        DispatchQueue.main.async { self.onTrigger?(binding) }
    }
}

// MARK: - Menu bar application

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let hotKeys = HotKeyManager()
    private var client: PrivateMediaClient?
    private var lastMessage = "Sẵn sàng"

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "▶"
        statusItem.button?.toolTip = "WorkRank Private Media"

        guard let config = ConfigStore.load() else {
            renderMenu(error: "Chưa ghép nối. Mở Work Rank → Điều khiển media để lấy mã.")
            return
        }

        client = PrivateMediaClient(config: config)
        let registered = hotKeys.install()
        hotKeys.onTrigger = { [weak self] binding in
            self?.send(action: binding.action, label: binding.label)
        }

        // Visible on stdout so an operator (or an audit script) can confirm the
        // OS accepted the global hotkeys without opening the menu.
        let labels = HotKeyManager.bindings.map(\.label).joined(separator: ", ")
        print("[helper] đã đăng ký \(registered)/\(HotKeyManager.bindings.count) phím tắt toàn hệ thống (\(labels))")
        fflush(stdout)

        renderMenu(error: registered == HotKeyManager.bindings.count
            ? nil
            : "Không đăng ký được phím tắt toàn hệ thống (\(registered)/\(HotKeyManager.bindings.count)).")
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotKeys.uninstall()
    }

    private func send(action: String, label: String) {
        guard let client else { return }
        statusItem.button?.title = "…"
        client.send(action: action) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case let .success(payload):
                    let code = payload["code"] as? String
                    if code == "NO_ACTIVE_MEDIA_SESSION" {
                        self.lastMessage = "\(label): chưa có video nào đang phát"
                        self.flash("∅")
                    } else {
                        let state = payload["state"] as? [String: Any]
                        let status = state?["status"] as? String ?? "OK"
                        self.lastMessage = "\(label): \(status)"
                        self.flash(status == "PLAYING" ? "▶" : status == "PAUSED" ? "❚❚" : "■")
                    }
                case let .failure(error):
                    self.lastMessage = error.localizedDescription
                    self.flash("⚠")
                }
                self.renderMenu(error: nil)
            }
        }
    }

    private func flash(_ symbol: String) {
        statusItem.button?.title = symbol
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { [weak self] in
            self?.statusItem.button?.title = "▶"
        }
    }

    private func renderMenu(error: String?) {
        let menu = NSMenu()
        let config = ConfigStore.load()

        let header = NSMenuItem(title: "WorkRank Private Media", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)

        let device = NSMenuItem(
            title: config.map { "Thiết bị: \($0.deviceName)" } ?? "Thiết bị: chưa ghép nối",
            action: nil,
            keyEquivalent: ""
        )
        device.isEnabled = false
        menu.addItem(device)

        let status = NSMenuItem(title: lastMessage, action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)

        if let error {
            let errorItem = NSMenuItem(title: error, action: nil, keyEquivalent: "")
            errorItem.isEnabled = false
            menu.addItem(errorItem)
        }

        menu.addItem(.separator())

        for binding in HotKeyManager.bindings {
            let title: String
            switch binding.action {
            case "TOGGLE_PLAY_PAUSE": title = "\(binding.label) — Phát / Tạm dừng"
            case "STOP": title = "\(binding.label) — Dừng"
            case "NEXT": title = "\(binding.label) — Video tiếp theo"
            default: title = binding.label
            }
            let item = NSMenuItem(title: title, action: #selector(triggerBinding(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = binding.action
            menu.addItem(item)
        }

        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Thoát", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))

        statusItem.menu = menu
    }

    @objc private func triggerBinding(_ sender: NSMenuItem) {
        guard let action = sender.representedObject as? String else { return }
        let label = HotKeyManager.bindings.first(where: { $0.action == action })?.label ?? action
        send(action: action, label: label)
    }
}

// MARK: - CLI

func printUsage() {
    let usage = """
    WorkRankPrivateMediaHelper — điều khiển Private Media bằng phím tắt toàn hệ thống.

    Cách dùng:
      swift run WorkRankPrivateMediaHelper --pair <MÃ> [--server <URL>] [--name <TÊN>]
          Ghép nối thiết bị bằng mã một lần lấy từ Work Rank, rồi lưu token.

      swift run WorkRankPrivateMediaHelper
          Chạy menu bar: F8 phát/tạm dừng, ⇧F8 dừng, F9 video tiếp theo.

      swift run WorkRankPrivateMediaHelper --self-test
          Gửi thử một lệnh TOGGLE_PLAY_PAUSE và in kết quả (kiểm tra token/quyền).

      swift run WorkRankPrivateMediaHelper --unpair
          Xóa token cục bộ trên máy này.
    """
    print(usage)
}

func runCLI() -> Int32 {
    let args = CommandLine.arguments
    func value(for flag: String) -> String? {
        guard let index = args.firstIndex(of: flag), index + 1 < args.count else { return nil }
        return args[index + 1]
    }

    let defaultServer = ProcessInfo.processInfo.environment["WORKRANK_SERVER"] ?? "http://localhost:5001"
    let server = value(for: "--server") ?? ConfigStore.load()?.serverURL ?? defaultServer

    if args.contains("--help") || args.contains("-h") {
        printUsage()
        return 0
    }

    if args.contains("--unpair") {
        ConfigStore.clear()
        print("Đã xóa token cục bộ.")
        return 0
    }

    if let code = value(for: "--pair") {
        let name = value(for: "--name") ?? Host.current().localizedName ?? "Mac"
        let semaphore = DispatchSemaphore(value: 0)
        var exitCode: Int32 = 1

        Pairing.pair(server: server, code: code, name: name) { result in
            switch result {
            case let .success(config):
                print("Đã ghép nối: \(config.deviceName) → \(config.serverURL)")
                print("Phím tắt: F8 phát/tạm dừng · ⇧F8 dừng · F9 video tiếp theo")
                exitCode = 0
            case let .failure(error):
                FileHandle.standardError.write(Data(("Lỗi: " + error.localizedDescription + "\n").utf8))
            }
            semaphore.signal()
        }

        semaphore.wait()
        return exitCode
    }

    if args.contains("--self-test") {
        guard let config = ConfigStore.load() else {
            FileHandle.standardError.write(Data((HelperError.notPaired.localizedDescription + "\n").utf8))
            return 2
        }
        let semaphore = DispatchSemaphore(value: 0)
        var exitCode: Int32 = 1
        PrivateMediaClient(config: config).send(action: "TOGGLE_PLAY_PAUSE") { result in
            switch result {
            case let .success(payload):
                let status = (payload["state"] as? [String: Any])?["status"] as? String ?? "UNKNOWN"
                print("OK — trạng thái phiên: \(status)")
                exitCode = 0
            case let .failure(error):
                FileHandle.standardError.write(Data(("Lỗi: " + error.localizedDescription + "\n").utf8))
            }
            semaphore.signal()
        }
        semaphore.wait()
        return exitCode
    }

    if ConfigStore.load() == nil {
        FileHandle.standardError.write(Data((HelperError.notPaired.localizedDescription + "\n").utf8))
        return 2
    }

    // GUI mode
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
    return 0
}

exit(runCLI())
