# Final gameplay UX polish — Direction / Computer / Memory / Typing

**FOUR_GAME_GAMEPLAY_UX_POLISH_PASS** · 2026-10-22 · kiểm chứng local end-to-end, backend MySQL thật.

## Các gate nghiệm thu

| Gate | Kết quả | Bằng chứng chính |
|---|---|---|
| `DIRECTION_STACKED_PREVIEW` | **PASS** | Bốn lớp chồng, opacity 1/.64/.32/.18, scale 1/.86/.72/.60, lớp cuối ◇. |
| `DIRECTION_WRONG_FEEDBACK` | **PASS** | Giữ cue và queue khi sai; CẦN/BẠN BẤM, combo x0; penalty hiển thị đo 480.4 ms. |
| `DIRECTION_INPUT_BUFFER` | **PASS** | Một phím đệm, không double consume, loại input trong penalty; keyboard/button/vuốt cùng đường xử lý. |
| `DIRECTION_MULTIPLAYER_FAIRNESS` | **PASS** | DUO/TRIO 60s thật; đối thủ tiếp tục khi mình sai; server xác nhận hạng/kết quả. |
| `COMPUTER_GAMEPLAY_UX` | **PASS** | Mục tiêu kế tiếp đổi ngay; lỗi tại ký tự; sửa Backspace/Enter; không trùng từ khi gõ nhanh. |
| `MEMORY_GAMEPLAY_UX` | **PASS** | Phase rõ, reveal meter, đúng/nhầm/sót + delta/combo; chơi tới 5×5; vùng tổng kết cố định. |
| `TYPING_GAMEPLAY_UX` | **PASS** | Active/correct/upcoming/error rõ; cuộn native; 620 ký tự, IME/caret/Backspace/draft; SOLO/DUO/TRIO. |
| `SHARED_GAME_DESIGN_SYSTEM` | **PASS** | HUD, focus, countdown/server clock, màu/spacing/motion hiện có; GAME COMPLETE 340ms; rail vượt hạng. |
| `MOBILE_GAMEPLAY` | **PASS** | 390/430/768/1024/1440; không tràn ngang; target/input/active line nhìn được ở 390×430. |
| `GAMEPLAY_PERFORMANCE` | **PASS** | CPU 4×: tất cả p95 ≤15.4 ms trong lượt được chấp nhận; 0 long task; CLS <.1. |
| `ACCESSIBILITY` | **PASS** | Axe WCAG 2A/AA/2.1AA: 0 violation trong phạm vi gameplay; thêm 47 cặp màu, keyboard, shape, reduced motion. |
| `PERSISTENCE_REGRESSION` | **PASS** | MySQL thật; kết quả/PB/history giữ nguyên sau restart và xóa storage; ledger 87 dòng không đổi. |
| `BACKEND_REGRESSION` | **PASS** | 117/117 test backend/engine/socket/persistence/Typing/Drawing guard, 0 fail/skip. |
| `FRONTEND_BUILD` | **PASS** | npm run check: 89 file, 0 lỗi; npm run build PASS; git diff --check PASS. |

## Trước và sau

| Game | Trước task | Sau task |
|---|---|---|
| Direction | Current + ba preview khá rõ theo hàng; cue vừa sai bị thay bởi challenge kế tiếp. | Stack bốn lớp chồng; foreground che các lớp sau; cuối chỉ là ◇. Khi sai giữ đúng cue vừa sai và vị trí các lớp đến hết penalty. |
| Computer | Giữ từ vừa hoàn thành khoảng 180ms trong khu mục tiêu, dù input logic đã ở từ kế tiếp. | Mục tiêu luôn là challenge hiện tại; từ cũ chuyển sang receipt. Progress ký tự, nhãn ngôn ngữ nhỏ, lỗi cục bộ. Key mục tiêu/receipt có namespace riêng để không trùng khi gõ nhanh. |
| Memory | Phase và feedback có sẵn nhưng thiếu số đúng/nhầm/sót, delta và tiến trình reveal. | Meter reveal; summary một dòng, cột cố định; ✓/×/◇ và viền khác nhau; roving focus bằng mũi tên/Home/End, Space/Enter chọn. |
| Typing | Chữ hoàn thành nhạt, lỗi chủ yếu bằng màu; active line được reposition tức thời. | Màu chữ rõ hơn; active có caret/underline; lỗi có nền, nét đứt, gạch lượn và micro cue; cuộn native mượt khi gần mép, reposition tức thời nếu marker sắp ra ngoài hoặc đổi virtual window. |

Direction advance dùng token `--motion-fast` 180ms, exit `--motion-instant` 100ms. Input cập nhật logic trước animation. Lớp cuối không hiển thị đáp án bằng glyph mũi tên. Không thêm blur, particles hoặc thư viện animation.

Đã loại nguyên nhân stack trôi khỏi foreground khi đổi viewport: FLIP layout không phù hợp các wrapper absolute chồng cùng bounds. Giữ wrapper `FlipList` hiện có với `enabled={false}`, chỉ transition transform/opacity của face. Native input, engine, minimum response 60ms, buffer một phím và penalty authoritative không đổi.

Computer chuyển target ngay sau submit; lỗi hiển thị tại chữ và nhãn sửa, không có full-screen red flash. Trong QA gõ nhanh đã phát hiện key của word và receipt trùng số index; tách thành `word-*` và `receipt-*`, rồi chạy lại DUO/TRIO và profile SOLO.

Memory cố định vùng tổng kết bằng lớp hint/result nằm trong cùng footprint. Phép đo đầu vượt .1 CLS; sau sửa giảm còn **0.071559**, dưới ngưỡng .1. Chữ phase/biểu tượng vẫn thay đổi theo lượt, không kéo dài animation để che lag. Ở reveal, avatar phụ ngừng idle animation để giảm nhiễu.

Typing giữ nguyên input native, NFC/composition, caret và virtual text window. Scroll chỉ smooth khi còn đủ vùng nhìn; ra ngoài, đổi block hoặc reduced-motion thì reposition ngay để bảo đảm active line không bị mất.

## Hệ arcade chung

- HUD có hierarchy timer → combo/hạng → điểm; số tabular, score/combo cập nhật tức thời khi chơi.
- Timer ≤10 giây có dấu chấm và màu áp lực. Countdown 3–2–1–GO theo clock của server; input trước start không được ghi nhận.
- Rail nhỏ giữ điểm/hạng; có tên người vừa vượt hoặc vừa vượt mình, dùng FLIP ranking hiện có.
- GAME COMPLETE giữ điểm/hạng đã xác nhận rồi chuyển result sau 340ms; đo thực tế **342.8ms**. Result/PB/history/BXH/play again của task trước được giữ.
- Focus rõ, lỗi có ký hiệu/viền ngoài màu; reduced-motion bỏ chuyển động, không đổi timing gameplay.
- Tái sử dụng sound chung: một AudioContext, sáu buffer đã prewarm, chung preference ở cả bốn route. Không thêm audio asset.

## Đo phản hồi và hiệu năng

Chromium 148 headless trên máy local, CPU throttling 4×; profile từng game riêng. Đây là phép đo event → RAF kế tiếp, dùng làm chỉ báo phản hồi UI; không phải đo input thiết bị → photon hoặc cam kết mọi input chỉ mất một frame. Không có ảnh chụp trong đoạn đo Direction. Computer/Memory harness có ảnh minh chứng theo mốc, được ghi rõ trong script.

| Game/mode | Input samples | Input → next frame p95 (ms) | Frame p95 (ms) | Gameplay CLS | Long task >50ms |
|---|---:|---:|---:|---:|---:|
| Direction | 40 | 15.4 | 10.1 | 0.000000 | 0 |
| Computer | 318 | 11.5 | 9.2 | 0.000000 | 0 |
| Memory — 90s deep QA | 53 | 5.1 | 9.1 | 0.071559 | 0 |
| Typing SOLO | 102 | 13.2 | 9.2 | 0.000019 | 0 |
| Typing 1V1 | 102 | 12.3 | 9.2 | 0.000015 | 0 |
| Typing TRIO | 102 | 14.6 | 16.8 | 0.000018 | 0 |

Direction wrong: DOM cue hiện sau **1.6ms** từ keydown; freeze quan sát bằng MutationObserver **480.4ms**, với penalty engine 450ms và clock UI cập nhật mỗi 50ms. Phép đo này không tính thời gian chụp ảnh hoặc thao tác harness vào penalty.

Memory deep QA dùng **override test server 90s** để đủ chơi 19 vòng, 3×3 → 4×4 → 5×5, năm viewport và CPU 4× trong một lượt. Đây là cấu hình môi trường kiểm thử, không sửa engine hoặc thời lượng mặc định. Sau đó đã trả server về 60s và kiểm tra SOLO persistence, DUO/TRIO full 60s trên cấu hình mặc định.

[Metrics JSON](performance-summary.json) · [Direction](direction/results.json) · [Computer](computer/device-performance-results.json) · [Memory](memory/device-performance-results.json) · [Typing](typing/typing-results.json)

## Responsive và gameplay thật

| Viewport | Direction | Computer | Memory | Typing |
|---|---|---|---|---|
| 390 | keyboard/button/vuốt, stack rõ | nhập/sửa, target không mất | nhớ/chọn/feedback | active/error/long text |
| 430 | PASS | PASS | PASS | PASS |
| 768 | PASS | PASS | PASS | PASS |
| 1024 | PASS | PASS | PASS | PASS |
| 1440 | PASS | PASS | PASS | PASS |

Không phát hiện scroll ngang. Direction button ≥44px; Memory tile ≥44px, kể cả bảng 5×5. Kiểm tra thêm viewport 390×430: Computer target và input cùng nhìn thấy; Typing active line và mini race local không bị che. Typing 620 ký tự qua nhiều virtual block, Backspace, offline/reload khôi phục draft đều PASS.

DUO/TRIO của Direction có penalty thật trong khi đối thủ tiếp tục ghi điểm, rồi full round, hạng 1/2/3, đọc DB. Computer và Memory có bốn trận DUO/TRIO 60s, input đúng/sai, combo reset, bị vượt, hạng cuối, retry finish hai lần, history và replay. Tổng **10 kết quả người chơi**, tám có XP với đúng một ledger/lượt; hai lượt Memory dưới điều kiện điểm có XP=0 và không tạo ledger. Không boost hay chèn điểm/rank vào client.

[Multiplayer JSON](multiplayer/results.json) · [Native/IME/draft/audio](native/native-input-results.json)

## Accessibility

Axe-core **4.14.0**, WCAG 2 A/AA và 2.1 AA, scope `.arcade-page`: **0 violation ở cả bốn game**. Đã sửa role của word/stack/control groups/typing tracks và contrast các nhãn nhỏ. Các node có nền pseudo-element được axe đánh dấu `incomplete`; bổ sung kiểm tra **47 cặp màu duy nhất** bằng foreground/background composite từ style thực tế và rà soát hình ảnh. Tất cả cặp đo đạt ngưỡng chữ tương ứng; không coi `incomplete` là một lần pass tự động.

Keyboard: focus rõ; Direction arrow/WASD, Memory roving focus + Space/Enter, Computer/Typing native input. Lỗi không phụ thuộc riêng màu. Reduced-motion đã kiểm tra theo cả OS media query và setting WorkRank; timing server không đổi.

[Accessibility JSON, gồm incomplete và cặp màu](accessibility/results.json)

## Bảo toàn dữ liệu và worktree

- Snapshot đầu task: `/Users/quynh/.codex/backups/workrank/2026-10-22-before-final-gameplay-polish`.
- Hash **260 file được bảo vệ không đổi** so với đầu task: backend/src, shared engine, session arcade và DrawingGame. Không reset/clean/discard, không commit/deploy.
- Đọc lại memento của dữ liệu cũ ngay sau thay UI: 11 mục PASS, gồm Drawing guard.
- Ghi mới bằng input browser thật: Computer, Direction, Memory SOLO 60s và Typing TRIO 30s vào MySQL 8.4.9, DB kiểm thử riêng `workrank_persistence_20261022_audit`.
- Kết quả có validatedAt, PB/BXH/history; lặp finalize hai lần không đổi kết quả hoặc nhân ledger.
- Dừng và khởi động lại Express fixture 5113, Vite 5283 và SeaweedFS S3 5125, giữ cùng DB/data. Không khởi động lại MySQL dùng chung.
- Browser B mới đọc cùng kết quả; logout, xóa cookies/cache/localStorage/sessionStorage/IndexedDB, reload, login API thật rồi đọc lại: **9 mục PASS**. Ledger trước/sau giữ nguyên **87 dòng**.
- Drawing không tạo artwork mới trong vòng cuối. Chỉ đọc artwork cũ sau restart: DB `CONFIRMED`, PNG có checksum trùng khớp. Không thiết lập kho ảnh production; việc triển khai storage production là task riêng.

[Protected hashes](protected-source-verification.json) · [Diff UI riêng task](task-ui-changes.diff) · [Persistence create](persistence-final/create-browser-results.json) · [Persistence restart/clear](persistence-final/read-browser-results.json) · [Drawing guard](drawing-readonly-guard.json)

## Số lượng kiểm tra

**117/117** test backend/engine/socket/Typing/Drawing authorization/storage/persistence, 0 fail, 0 skip. Frontend check 89 file, 0 lỗi, build PASS.

| Báo cáo kịch bản | Số mục ghi nhận |
|---|---:|
| Direction | 10 PASS |
| Computer | 11 PASS |
| Memory | 16 PASS |
| Native input | 7 PASS |
| Accessibility | 5 PASS |
| Multiplayer Computer/Memory | 9 PASS |
| Persistence dữ liệu cũ | 11 PASS |
| Persistence ghi mới | 5 PASS |
| Persistence sau restart | 9 PASS |
| Typing modes | 3 PASS |
| Drawing guard chỉ đọc | 1 PASS |
| Tổng mục kịch bản/guard được ghi trong báo cáo | 87 PASS |

Các mục browser là kịch bản tổng hợp, không quy đổi thành số unit assertion. Bốn axe audits và 47 cặp màu được liệt kê riêng phía trên.

Backend command:

```sh
cd /Applications/du-an/workrank/workrank-realtime/backend
NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 test/arcade_engine.test.js test/arcade_http.test.js test/arcade_service.test.js test/typing*.test.js test/drawing_authorization.test.js test/drawing_storage.test.js test/persistence_regressions.test.js test/socket_room_auth.test.js
```

Các browser harness trong `frontend/scripts/`: `final-direction-stack-audit.mjs`, `arcade-ux-final-audit.mjs`, `four-games-typing-audit.mjs`, `four-games-native-audit.mjs`, `final-computer-memory-multiplayer-audit.mjs`, `final-gameplay-a11y-audit.mjs`, `persistence-browser-audit.mjs`. Dùng fixture backend thật, không mock kết quả. `PERSIST_GAMES_ONLY=1` giới hạn vòng persistence cuối đúng bốn game.

Các lần đo chưa đạt và ảnh chẩn đoán được giữ trong `diagnostics/`; JSON của lượt được chấp nhận đều có `errors: []`. Harness multiplayer ban đầu giả định mọi kết quả có ledger; đã sửa assertion theo luật XP thực tế và đối chiếu lại cả 10 row. [DB verification](logs/multiplayer-db-verification.log) xác nhận điều kiện 1/0 ledger đúng, không sửa luật cấp XP.

## File UI thay đổi trong task này

- [TypingPassage.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/TypingPassage.jsx)
- [ArcadeGame.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/ArcadeGame.jsx)
- [ArcadeShared.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/ArcadeShared.jsx)
- [TypingArcadeView.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/TypingArcadeView.jsx)
- [direction-queue.css](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/direction-queue.css)
- [MemoryBoard.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/MemoryBoard.jsx)
- [DirectionArena.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/DirectionArena.jsx)
- [ArcadePlay.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/ArcadePlay.jsx)
- [RaceStrip.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/RaceStrip.jsx)
- [ArcadeTutorial.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/ArcadeTutorial.jsx)
- [TypingRaceTracks.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/TypingRaceTracks.jsx)
- [ComputerStation.jsx](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/ComputerStation.jsx)
- [gameplay-polish.css](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/arcade/gameplay-polish.css)

## Giới hạn kiểm chứng còn lại

Không có lỗi chặn nào trong phạm vi task sau vòng xác nhận cuối. Mobile/keyboard là Chromium touch + viewport emulation; composition tiếng Việt được kiểm tra bằng CompositionEvent/NFD và input native, chưa kiểm tra trên bàn phím UniKey/iOS/Android vật lý. Axe + kiểm tra màu/hình ảnh/keyboard không thay thế một đợt kiểm thử screen reader độc lập. Kết quả hiệu năng là số đo local của fixture/dev build, không phải số đo production trên mọi thiết bị.
