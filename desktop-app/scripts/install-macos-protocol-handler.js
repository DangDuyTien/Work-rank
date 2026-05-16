const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoAppDir = path.resolve(__dirname, '..');
const electronBin = path.join(repoAppDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const electronApp = path.join(repoAppDir, 'node_modules/electron/dist/Electron.app');
const targetApp = process.env.WORKRANK_PROTOCOL_HANDLER_APP || '/Applications/WorkRank Tracker Dev.app';
const defaultApiUrl = process.env.API_URL || 'https://workrank.onrender.com';
const macosDir = path.join(targetApp, 'Contents/MacOS');
const plistPath = path.join(targetApp, 'Contents/Info.plist');
const executablePath = path.join(macosDir, 'WorkRankTrackerDev');
const swiftSourcePath = path.join(macosDir, 'WorkRankTrackerDev.swift');
const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

if (process.platform !== 'darwin') {
  console.log('install-protocol:mac chỉ dùng cho macOS.');
  process.exit(0);
}

if (!fs.existsSync(electronBin)) {
  throw new Error(`Không tìm thấy Electron binary: ${electronBin}`);
}

fs.mkdirSync(macosDir, { recursive: true });

fs.writeFileSync(plistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>WorkRankTrackerDev</string>
  <key>CFBundleIdentifier</key>
  <string>local.workrank.tracker.dev</string>
  <key>CFBundleName</key>
  <string>WorkRank Tracker Dev</string>
  <key>CFBundleDisplayName</key>
  <string>WorkRank Tracker Dev</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>WorkRank Tracker</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>workrank</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
`);

fs.writeFileSync(swiftSourcePath, `import Cocoa

let electronBin = ${JSON.stringify(electronBin)}
let repoAppDir = ${JSON.stringify(repoAppDir)}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var launched = false

  override init() {
    super.init()
    NSAppleEventManager.shared().setEventHandler(
      self,
      andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
      forEventClass: AEEventClass(kInternetEventClass),
      andEventID: AEEventID(kAEGetURL)
    )
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
      if !self.launched {
        self.launchDesktop(url: nil)
      }
    }
  }

  @objc func handleGetURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
    let url = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue
    launchDesktop(url: url)
  }

  private func launchDesktop(url: String?) {
    if launched { return }
    launched = true

    let process = Process()
    process.executableURL = URL(fileURLWithPath: electronBin)
    process.arguments = [repoAppDir] + (url.map { [$0] } ?? [])
    var env = ProcessInfo.processInfo.environment
    if env["API_URL"] == nil {
      env["API_URL"] = ${JSON.stringify(defaultApiUrl)}
    }
    env["WORKRANK_SKIP_PROTOCOL_REGISTER"] = "true"
    process.environment = env

    do {
      try process.run()
    } catch {
      NSLog("Failed to launch WorkRank desktop: \\(error.localizedDescription)")
    }
    NSApp.terminate(nil)
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
`);

execFileSync('/usr/bin/swiftc', [swiftSourcePath, '-o', executablePath], { stdio: 'inherit' });
fs.chmodSync(executablePath, 0o755);

try {
  execFileSync(lsregister, ['-u', electronApp], { stdio: 'ignore' });
} catch {
  // Electron may not have been registered; ignore.
}

execFileSync(lsregister, ['-f', targetApp], { stdio: 'inherit' });
execFileSync('/usr/bin/swift', [
  '-e',
  'import Foundation; import CoreServices; let status = LSSetDefaultHandlerForURLScheme("workrank" as NSString, "local.workrank.tracker.dev" as NSString); if status != 0 { exit(1) }',
], { stdio: 'inherit' });
console.log(`Đã cài protocol handler: ${targetApp}`);
