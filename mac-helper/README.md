# WorkRank Private Media — macOS Helper

Menu-bar helper that turns a **global** key press into a Private Media command,
even when Work Rank is not the focused app.

```text
F8        → Play / Pause   (required default)
⇧ F8      → Stop
F9        → Next video
```

## Why Carbon and not an event tap

`RegisterEventHotKey` (Carbon) is the only global-hotkey API that works without
Accessibility permissions. A `CGEventTap` would require the user to grant
"Input Monitoring"/"Accessibility" and would also let the helper observe every
keystroke — neither is necessary for three fixed shortcuts.

## Security model

* **No local HTTP server.** The helper never listens on a port, so no other
  process on the machine can drive the player through it.
* **Scoped device token.** Issued once by the backend after a one-time pairing
  code, stored at
  `~/Library/Application Support/WorkRankPrivateMedia/config.json` with mode
  `0600`, and only ever sent as `X-Device-Token` to
  `POST /api/private-media/device/commands`.
* **Server re-checks every press.** The backend resolves token → device →
  user → live entitlement. Revoking the grant or the device makes the very next
  F8 return `404`.
* **No secrets in the UI.** The token is printed exactly once, at pairing.

## Build

```bash
cd workrank-realtime/mac-helper
swift build --disable-sandbox      # --disable-sandbox is only needed in sandboxed CI
```

The binary lands in `.build/debug/WorkRankPrivateMediaHelper`.

## Pair

1. Work Rank → **Điều khiển media** → **Phím tắt toàn hệ thống** → *Tạo mã ghép nối*.
2. Run:

```bash
swift run WorkRankPrivateMediaHelper --pair ABC23DEF --server http://localhost:5001
```

Use your real backend URL for `--server` (or set `WORKRANK_SERVER`).

## Run

```bash
swift run WorkRankPrivateMediaHelper
```

A `▶` item appears in the menu bar. On success it prints:

```text
[helper] đã đăng ký 3/3 phím tắt toàn hệ thống (F8, ⇧F8, F9)
```

If it prints fewer than 3, another app already owns that shortcut.

## Verify the command path without pressing a key

```bash
swift run WorkRankPrivateMediaHelper --self-test
# OK — trạng thái phiên: PLAYING
```

This proves token + entitlement + command bus. It does **not** prove that the
physical F8 key reaches the helper — see the note below.

## Note about F8 on modern Macs

On Macs where the function row defaults to media keys, `F8` sends the
"play/pause media" key instead of `kVK_F8`. Either press `fn + F8`, or enable
**System Settings → Keyboard → Use F1, F2, etc. keys as standard function keys**.
The helper deliberately registers the *standard* F8 so it does not hijack the
system media key.

## Unpair / revoke

```bash
swift run WorkRankPrivateMediaHelper --unpair   # removes the local token
```

Revoking the device in the Work Rank UI (or revoking the user's grant) is
authoritative and takes effect immediately on the server side.
