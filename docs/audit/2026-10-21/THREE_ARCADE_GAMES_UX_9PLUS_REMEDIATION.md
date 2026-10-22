# Three Arcade Games — UI/UX + Game Feel 9+ Remediation

Ngày audit: 2026-10-21. Project: `/Applications/du-an/workrank/workrank-realtime`.

## Phạm vi và cách đọc điểm

Cải tiến cả Computer Rush, Direction Rush và Memory Flash. Điểm là **tự đánh giá heuristic của reviewer sau tương tác trình duyệt thật**, không phải kết quả khảo sát người dùng độc lập. “Game feel / fun” và “Replay desire” là nhận định thiết kế có bằng chứng hành vi, không phải thang đo tâm lý hay retention thực tế. Không dùng build/test pass để suy ra điểm UX.

Quy trình đã làm: PLAY → OBSERVE → SCORE → IMPROVE → PLAY AGAIN → RESCORE. Baseline và iteration 1: mỗi vòng 6 trận (3 Solo + 3 Trio). Iteration 2 và 3: mỗi vòng 9 trận (3 Solo + 3 Duo + 3 Trio). Sau đó chơi lại ván mặc định 60 giây cho cả ba game, đo CPU 4x, kiểm tra sâu Memory 5×5 trên mobile và thực hiện một lượt sửa bổ sung khi phép đo mobile chưa đạt.

Các script Playwright chạy Chromium thật, bấm phím, nút, vuốt CDP, gõ vào native input, click tile, vào kết quả và bấm chơi lại. API chỉ dùng cho tài khoản/phòng và đối chiếu trạng thái máy chủ; điểm cuối được server replay từ evidence, không gửi điểm tự nhận. Bot Memory ghi lại pattern đang sáng để kiểm tra giao diện và luồng; số vòng đúng không đo trí nhớ của người dùng thật.

Fixture `NODE_ENV=test` dùng SQLite `:memory:`, bind `127.0.0.1`. Không ghi vào DB sản phẩm. Các trận rút gọn dùng 24s để lặp Solo/Duo/Trio; đối chiếu cuối dùng đúng mặc định 60s.

## Baseline Scores

### Computer Rush

| Category | Điểm |
|---|---:|
| First-time understandability | 7.0 |
| Visual hierarchy | 6.5 |
| Input responsiveness | 8.8 |
| Correct/wrong feedback | 6.0 |
| Game feel / fun | 6.0 |
| Progression / pacing | 6.5 |
| Multiplayer clarity | 6.0 |
| Result satisfaction | 6.0 |
| Mobile experience | 6.0 |
| Replay desire | 5.0 |
| **Trung bình** | **6.38** |

### Direction Rush

| Category | Điểm |
|---|---:|
| First-time understandability | 7.5 |
| Visual hierarchy | 6.5 |
| Input responsiveness | 8.8 |
| Correct/wrong feedback | 4.0 |
| Game feel / fun | 5.0 |
| Progression / pacing | 5.5 |
| Multiplayer clarity | 6.0 |
| Result satisfaction | 6.0 |
| Mobile experience | 7.0 |
| Replay desire | 5.0 |
| **Trung bình** | **6.13** |

### Memory Flash

| Category | Điểm |
|---|---:|
| First-time understandability | 7.0 |
| Visual hierarchy | 7.0 |
| Input responsiveness | 8.5 |
| Correct/wrong feedback | 4.0 |
| Game feel / fun | 5.5 |
| Progression / pacing | 6.0 |
| Multiplayer clarity | 6.0 |
| Result satisfaction | 6.0 |
| Mobile experience | 7.0 |
| Replay desire | 5.0 |
| **Trung bình** | **6.20** |

Bằng chứng baseline: [6 trận và kết quả đồng nhất giữa các người chơi](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/baseline/gameplay-results.json).

## UX Problems Found

| Game / vùng | Mức độ | Quan sát khi chơi | Hệ quả |
|---|---|---|---|
| Computer — target/input | Cao | Từ nằm trên màn hình, input tách xuống dưới nhân vật | Mắt phải đi xa giữa đọc và gõ |
| Computer — ký tự | Cao | Sai chỉ thấy input đổi trạng thái chung | Khó biết chỗ cần Backspace |
| Computer — nhịp | Vừa | Phản hồi thành công nhỏ, combo chủ yếu là số | Hoàn thành từ thiếu cảm giác nhận thưởng |
| Direction — sai | Nghiêm trọng | X nhỏ; arrow đổi; dòng nhắc ở xa | Không biết vừa sai ở hướng nào |
| Direction — pacing | Cao | Lặp lại đọc một mũi tên với ít thay đổi | Nhanh thành bài bấm đơn điệu |
| Direction — entrance | Cao | Ở bản polish đầu, normal cue có thể nghiêng một frame do đồng hồ chưa tới previousAt | Người chơi có thể hiểu sai hướng dù chưa đến màn xoay |
| Memory — lỗi | Nghiêm trọng | Bảng kế tiếp thay quá nhanh | Không biết ô chọn nhầm hoặc bỏ sót |
| Memory — độ khó | Cao | Đổi nhiều biến ở ranh giới level | Dễ hụt nhịp, khó nhận ra mình đang học gì |
| Multiplayer | Cao | Chỉ tên và điểm, thiếu vị trí/chênh lệch rõ | Cảm giác Solo có thêm người đứng cạnh |
| Result/replay | Cao | Kết quả chung chung; chơi lại quay về menu | Mất động lực thử lại ngay |
| Mobile Memory sau iteration 2 | Nghiêm trọng | Companion có thể lấn bảng do flex sizing | Che tile, không chấp nhận |
| Mobile Memory khi đo sâu | Cao | Bảng tăng kích thước đẩy phần bên dưới; CLS 0.256 | Layout nhảy ở thời điểm chuyển level |
| Mobile touch tile | Vừa | Hover CSS cũ còn giữ màu trên ô | Màu SELECT thiếu đồng nhất, có thể làm ô chọn kém rõ |

## Iteration 1 — sửa trọng tâm gameplay

**Computer:** gom target và native input vào một monitor; phân biệt ký tự đúng, sai, cursor, pending và composing. Giữ IME/native editing, Backspace, NFC và chữ thường. Thêm receipt từ vừa hoàn thành, điểm tăng, monitor/nhân vật phản ứng và các mốc combo 3/5/10/20. Kho mixed đi từ từ dễ → từ vừa → cụm ngắn → tiếng Việt xen từ vừa.

**Direction:** arrow thành object chính; feedback nằm ngay dưới stimulus, có chữ, màu, điểm và “CẦN / BẠN BẤM”; dash/bump, border flash ngắn, combo reset. Thêm vị trí lệch, màu không mã hóa đáp án, entrance 180ms trước response window và biển cam ĐẢO CHIỀU ở phần muộn của trận. Đáp án expected tính lại trên server.

**Memory:** rõ PREPARE / FLASH / HIDE / SELECT / REVIEW; khi sai giữ 800ms và đánh dấu ✓ xanh / × đỏ / ★ vàng. Selected có fill và dấu check. Pattern đa dạng, không lộ lựa chọn đối thủ. Ramp thay size, số target, thời gian từng bước; phiên bản cũ vẫn replay theo luật cũ.

**Chung:** nhân vật lớn hơn, compact race strip với vị trí/chênh lệch/progress, phản ứng của đối thủ theo cadence đồng bộ; goal phá PB, cảnh báo cuối giờ, reduced motion. Input local không chờ request mạng.

Sau khi chơi lại, feedback tốt lên rõ nhưng kết quả/replay và chiều cao scene vẫn dưới chuẩn. Không đóng phase ở đây.

| Game | Baseline | Iteration 1 |
|---|---:|---:|
| Computer Rush | 6.38 | 7.75 |
| Direction Rush | 6.13 | 7.75 |
| Memory Flash | 6.20 | 7.92 |

[Gameplay iteration 1](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration1/gameplay-results.json) · [Rubric đủ 10 mục](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration1/rubric.json)

## Iteration 2 — onboarding, race, kết quả và replay

- Tutorial minh họa 3 bước, có thu gọn/đã hiểu; ghi nhớ lựa chọn. Khi vào chơi cũng ghi nhận đã xem để người quay lại không bị buộc xem lại. Hỗ trợ tutorial tĩnh theo giảm chuyển động.
- HUD gọn; đưa thứ hạng gần gameplay. Bỏ race card trùng điểm trong Solo. Race reorder dùng FlipList và key ổn định.
- Thu chiều cao Direction; sửa điều kiện entrance thành `revealMs > 0` trước khi cho animation chạy. Nút điều khiển lớn, WASD và vuốt giữ nguyên.
- Memory chuyển companion sang cạnh bảng ở desktop, bố trí riêng trên mobile; legend, phase và timeout ở gần bảng.
- Result có PB do server tính theo game/mode/difficulty/duration/rulesVersion, improvement hoặc số điểm còn thiếu; highlight 4 metric, podium nhiều người, avatar và CTA.
- `rematch` tạo một phòng kế tiếp chung có seed mới, giữ cấu hình. Solo đi thẳng countdown; Duo/Trio về phòng nhóm để từng người tự sẵn sàng. Nhiều click đồng thời không tách nhóm, không phát thưởng lại.
- Migration thêm `rules_version` và `rematch_id`; hàng cũ nhận version 1, game mới version 2, BXH tách hợp đồng tính điểm.

Đã chơi đủ 9 trận Solo/Duo/Trio. Khi review ảnh, thấy mobile Memory còn chồng companion lên tile. Vì vậy điểm mobile 7.5 và overall vẫn FAIL. Điểm first-time ở vòng này giới hạn 8.5 cho đến khi tutorial được thao tác và kiểm tra reload ở vòng sau.

| Game | Iteration 2 | Mục thấp nhất | Kết luận |
|---|---:|---:|---|
| Computer Rush | 8.94 | 8.5 | Tiếp tục |
| Direction Rush | 8.96 | 8.5 | Tiếp tục |
| Memory Flash | 8.81 | 7.5 | Tiếp tục |

[9 trận + 9 luồng quick replay](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration2/gameplay-results.json) · [Rubric iteration 2](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration2/rubric.json)

## Additional Iterations — tự review sau khi tưởng đã đủ

### Iteration 3

Sửa mobile Memory bằng grid có hàng riêng cho board và nhân vật; đo bounding box để bảo đảm không giao nhau. Sửa CSS hover cũ để SELECT ẩn đồng nhất, ô chọn giữ fill xanh rõ ngay cả khi con trỏ còn nằm trên ô. Giữ sẵn vị trí thanh selection time thay vì mount/unmount gây đẩy layout. Computer hiển thị câu milestone thật trong receipt. Chơi lại đủ 9 trận và replay chung nhóm; review ảnh Solo/Trio/result.

Kiểm tra sâu hơn sau đó phát hiện hai giới hạn chưa thể kết luận PASS: Computer ở viewport 390×430 còn sát mép dưới (0.36px theo DOM); Memory trên mobile khi tăng 3×3 → 4×4 → 5×5 có CLS 0.256. Dù điểm trung bình đã gần/vượt 9, mục mobile Memory được hạ xuống 8.4, không bỏ qua ngưỡng từng mục.

[9 trận iteration 3 và shared rematch](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/gameplay-results.json) · [Rubric trước sửa mobile cuối](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/rubric.json) · [Phép đo trước sửa vùng bảng cố định](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/debug/before-fixed-mobile-board.json)

### Iteration 4 — sửa đúng nguyên nhân và chơi lại

Memory dành sẵn hàng 304px cho bảng trên mobile và 90px cho companion; desktop dành vùng 330px cho tableau. Profiling sau sửa vùng ngoài cho thấy chính board còn đổi bounding box, heading co theo nội dung và companion co theo lời nhắc (CLS tổng 0.1885), nên tiếp tục sửa: khung board giữ 304×304 mobile / 328×328 desktop, tile chia đều phần bên trong, heading/companion có chiều rộng ổn định. Một kích thước grid mới tạo một board mới trong vùng cố định, không tái dùng tọa độ ô từ bảng có hệ hàng/cột khác. Tile dùng border-box để selected border không làm đổi kích thước. Combo/chuỗi luôn hiện ngay trong HUD; cạnh tranh vẫn hiện hạng và combo. Footer giữ feedback mốc lớn nhưng không còn là nơi duy nhất để đọc combo.

Computer xử lý visualViewport resize ở RAF kế tiếp và cuộn input về giữa vùng nhìn; target ở ngay phía trên nên cả hai cùng nhìn thấy khi chiều cao còn 430px. Listener/RAF được cleanup. Memory dời mốc giảm selection time tới nấc riêng sau khi ramp size/targets/reveal hoàn tất, để không đổi hai biến cùng nấc; server replay và kiểm tra 14 nấc xác nhận điều này.

Sau sửa đã chạy lại audit 60s cho cả ba game, tutorial thường và reduced motion, 5 viewport có tương tác, short viewport, CPU 4x, Memory tới 5×5 ở 390px, kết quả và quick replay. Kết quả cuối ở phần dưới.

Audit cuối gồm hai lượt có ghi rõ `sourceRuns`: Computer/Direction hoàn thành trên bản cuối của hai game; sau đó sửa CSS riêng Memory và retest đầy đủ Memory. Báo cáo giữ nguyên các phép đo thất bại trong `final/debug`, không lấy kết quả trước sửa làm PASS cho Memory.

## Real Browser Evidence

- **baseline**: 6 trận hoàn chỉnh; không có page error trong báo cáo. [JSON](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/baseline/gameplay-results.json)
- **iteration1**: 6 trận hoàn chỉnh; không có page error trong báo cáo. [JSON](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration1/gameplay-results.json)
- **iteration2**: 9 trận hoàn chỉnh; không có page error trong báo cáo. [JSON](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration2/gameplay-results.json)
- **iteration3**: 9 trận hoàn chỉnh; không có page error trong báo cáo. [JSON](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/gameplay-results.json)
- **Final**: [tất cả device/gameplay/performance checks](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/device-performance-results.json).
- **Final Trio**: thêm 3 trận và 3 shared quick replay trên giao diện cuối; Memory retest riêng sau khi tăng hàng đối thủ từ 90px lên 120px để nhãn vòng/chuỗi cách thanh phase. [JSON có sourceRuns](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/gameplay-results.json).

| Game | Chuỗi thao tác đã kiểm tra | Bằng chứng |
|---|---|---|
| Computer | Gõ sai → thấy ký tự đỏ → Backspace → hoàn thành; mixed tới tiếng Việt, mốc combo; 390×430; kết quả và chơi lại | [combo](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-combo-20.png) · [viewport thấp](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-short-viewport-390x430.png) |
| Direction | Mũi tên/WASD, nút, vuốt touch; wrong expected/pressed; 24 input CPU4x; entrance guard; opposite muộn → luật thường | [sai](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/direction_rush-SOLO-wrong.png) · [opposite](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-opposite.png) · [trio](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-TRIO-gameplay.png) |
| Memory | Xem FLASH → SELECT không after-image → chọn/bỏ chọn → REVIEW đủ ba loại ô; chơi 19 vòng tới 5×5 mobile, 18 vòng đúng | [lỗi mobile](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-390-wrong-3x3.png) · [5×5](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-deep-memorize-5x5.png) · [trio](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-TRIO-gameplay.png) |
| Kết quả | PB có nguồn server, 4 metric, podium; bấm replay một lần và đối chiếu cả nhóm về một ID mới, seed mới, ready reset | [Computer result](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-result-390.png) · [Direction result](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-result-390.png) · [Memory result](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-result-390.png) |

### Responsive và performance sau polish

Mỗi game đã có hành động gameplay ở **390, 430, 768, 1024, 1440px**, không chỉ chụp menu. Có kiểm tra overflow ngang. Direction dùng CDP touch swipe trên context touch; Memory tile tối thiểu 44px qua các kích thước/bảng đã chơi. Computer 390×430 mô phỏng phần nhìn còn lại khi bàn phím chiếm màn hình; đây không phải đo trên bàn phím vật lý của điện thoại.

Phép đo CPU4x dùng RAF và input event → RAF tiếp theo. Đây là phép đo responsiveness trên máy audit, không phải cam kết FPS trên mọi máy. CLS chỉ đo gameplay sau khi ổn định viewport, không tính lần đổi kích thước do kiểm tra responsive. Có PerformanceObserver cho long task. Kết quả:

| Game | Input samples | Input→frame p50 / p95 (ms) | Frame p95 (ms) | CLS gameplay | Long tasks >50ms |
|---|---:|---:|---:|---:|---:|
| Direction Rush | 24 | 11.7 / 14.8 | 24.4 | 0.0000 | 0 |
| Computer Rush | 333 | 6.3 / 18.1 | 17.3 | 0.0000 | 0 |
| Memory Flash | 53 | 3.6 / 5.9 | 9.2 | 0.0603 | 0 |

Không mất 24 phím Direction liên tiếp dưới CPU4x. Computer kiểm tra mỗi từ phải sinh event kế tiếp; Memory đối chiếu selected/review và kết quả server. Reduced motion được kiểm tra cả thuộc tính cài đặt WorkRank trong trận và media preference ở tutorial. Không thêm animation library, không tăng duration để che giật; các hiệu ứng mới dùng transform/opacity và token motion có sẵn.

### Kiểm tra kỹ thuật hỗ trợ

- `frontend/npm run check`: PASS, 84 file, 0 lỗi.
- `frontend/npm run build`: PASS. Có cảnh báo sẵn ở `Friends.jsx` (duplicate object keys) và CSS global (`Unexpected @media`); không thuộc phần arcade.
- Bộ regression liên quan: **46/46 PASS**, gồm arcade engine/service/HTTP, game catalog, socket auth và Typing lifecycle/socket. Sau sửa ramp cuối chạy lại bộ arcade: **22/22 PASS**.
- Server kiểm tra rulesVersion, replay expected direction/opposite, earliest response, memory timeout/cells; không tin score/PB client. Reward/finalize giữ idempotency. Rematch đồng thời chung phòng và không phát thưởng lại được kiểm tra. Migration có kiểm tra repeatability và default1 cho schema cũ.
- `git diff --check`: PASS. Không commit/stage thay đổi; giữ các thay đổi ngoài arcade của workspace.

## Final Scores

Điểm dưới đây chỉ được chốt sau vòng browser cuối. Mỗi dòng có bằng chứng tương ứng; các nhận định “vui” dựa vào nhịp feedback, mức độ rõ của tiến trình và luồng replay đã thao tác. Cần user study độc lập để đo mức thích chơi/retention bên ngoài heuristic này.

| Game | Category | Score | Evidence / lý do |
|---|---|---:|---|
| Computer Rush | First-time understandability | 9.0 | [Demo WORK → gõ → check; 3 bước, dismiss/reload đã thử](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-tutorial-390.png) |
| Computer Rush | Visual hierarchy | 9.1 | [Target và input cùng monitor, HUD không lấn vùng gõ](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-gameplay-1440.png) |
| Computer Rush | Input responsiveness | 9.3 | [Native input; 20 từ đo CPU4x; event tiến đúng mỗi từ](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/device-performance-results.json) |
| Computer Rush | Correct/wrong feedback | 9.1 | [Char state đỏ, receipt từ trước + điểm, monitor/actor phản ứng](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/computer_rush-SOLO-wrong.png) |
| Computer Rush | Game feel / fun | 9.0 | [Mốc 3/5/10/20, receipt milestone, score pop và character hop](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-combo-20.png) |
| Computer Rush | Progression / pacing | 8.9 | [Chơi mixed qua từ dễ/vừa/cụm/Việt, không khóa input để đợi mạng](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/device-performance-results.json) |
| Computer Rush | Multiplayer clarity | 9.0 | [Workstations, rank/gap/race track, peer correct reaction](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-TRIO-gameplay.png) |
| Computer Rush | Result satisfaction | 9.2 | [PB thật, 4 metric, số điểm/improvement, CTA rõ](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-result-390.png) |
| Computer Rush | Mobile experience | 8.9 | [5 viewport tương tác và target/input cùng thấy khi viewport thấp](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/computer_rush-short-viewport-390x430.png) |
| Computer Rush | Replay desire | 9.2 | [Một click vào countdown lượt mới, giữ cấu hình](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/computer_rush-SOLO-quick-replay.png) |
| Direction Rush | First-time understandability | 9.0 | [Demo ↑ → phím ↑/W → dash; luật bỏ qua vị trí/màu, biển đảo rõ](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-tutorial-390.png) |
| Direction Rush | Visual hierarchy | 9.2 | [Stimulus lớn, response bar, feedback ngay dưới arrow](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-gameplay-1440.png) |
| Direction Rush | Input responsiveness | 9.3 | [24 input CPU4x không mất; phím/WASD/nút/vuốt đã thao tác](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/device-performance-results.json) |
| Direction Rush | Correct/wrong feedback | 9.4 | [CẦN vs BẠN BẤM, border/actor/text/combo; không chỉ dấu X](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/direction_rush-SOLO-wrong.png) |
| Direction Rush | Game feel / fun | 9.1 | [Dash hướng thực, PERFECT/GOOD, burst/điểm và combo](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/iteration3/direction_rush-SOLO-correct.png) |
| Direction Rush | Progression / pacing | 9.0 | [60s: position/color/entrance/opposite/final; chỉ đảo ở biển cam](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-opposite.png) |
| Direction Rush | Multiplayer clarity | 9.0 | [Lanes và phản ứng, rank/score/gap; local stimulus trội](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-TRIO-gameplay.png) |
| Direction Rush | Result satisfaction | 9.1 | [Perfect, accuracy, combo, phản xạ; sai/timeout gọn](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-result-390.png) |
| Direction Rush | Mobile experience | 8.8 | [Swipe và nút lớn; HUD luôn đọc được thời gian/rank/combo](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-gameplay-390.png) |
| Direction Rush | Replay desire | 9.1 | [Chơi lại cùng nhóm đã được click và đối chiếu một phòng mới](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/direction_rush-TRIO-quick-replay.png) |
| Memory Flash | First-time understandability | 9.1 | [Demo sáng → tắt → chọn; phase và hành động kế tiếp rõ](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-tutorial-390.png) |
| Memory Flash | Visual hierarchy | 9.1 | [Bảng là trung tâm, không bị nhân vật đè; HUD đọc được](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-deep-memorize-5x5.png) |
| Memory Flash | Input responsiveness | 9.2 | [Selected/deselect phản hồi local; click đúng 19 lượt và CPU4x](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/device-performance-results.json) |
| Memory Flash | Correct/wrong feedback | 9.4 | [800ms REVIEW có đúng xanh/check, nhầm đỏ/x, thiếu vàng/star](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-390-wrong-3x3.png) |
| Memory Flash | Game feel / fun | 9.0 | [Character phản ứng, board pulse, chuỗi/điểm; lỗi có tính học lại](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-TRIO-gameplay.png) |
| Memory Flash | Progression / pacing | 9.0 | [Chơi 3×3→4×4→5×5; giữ reveal khi tăng size, tách biến ở từng nấc](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/device-performance-results.json) |
| Memory Flash | Multiplayer clarity | 9.0 | [Chỉ công khai vòng/chuỗi/điểm/trạng thái; không hiển thị cells của peer](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-TRIO-gameplay.png) |
| Memory Flash | Result satisfaction | 9.1 | [Vòng đúng, accuracy, chuỗi và PB thực; CTA không qua menu](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-result-390.png) |
| Memory Flash | Mobile experience | 8.8 | [5×5 chơi ở390px, tile≥44, vùng bảng cố định, combo trong HUD](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-deep-memorize-5x5.png) |
| Memory Flash | Replay desire | 9.1 | [Giữ nhóm/config và challenge mới; replay đã đi tới phòng mới](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-21/arcade-ux/final/memory_flash-TRIO-quick-replay.png) |

| Game | Baseline | Iteration 1 | Iteration 2 | Iteration 3 trước sửa mobile cuối | Final | Mục thấp nhất |
|---|---:|---:|---:|---:|---:|---:|
| Computer Rush | 6.38 | 7.75 | 8.94 | 9.03 | **9.07** | 8.9 |
| Direction Rush | 6.13 | 7.75 | 8.96 | 9.10 | **9.10** | 8.8 |
| Memory Flash | 6.20 | 7.92 | 8.81 | 9.04 | **9.08** | 8.8 |

## Required Final Gates

COMPUTER FIRST-TIME UX: PASS  
COMPUTER GAME FEEL: PASS  
COMPUTER MULTIPLAYER UX: PASS  
COMPUTER RESULT UX: PASS  
COMPUTER FINAL SCORE: 9.07/10

DIRECTION FIRST-TIME UX: PASS  
DIRECTION CORRECT FEEDBACK: PASS  
DIRECTION WRONG FEEDBACK: PASS  
DIRECTION TRICK FAIRNESS: PASS  
DIRECTION GAME FEEL: PASS  
DIRECTION MULTIPLAYER UX: PASS  
DIRECTION FINAL SCORE: 9.10/10

MEMORY FIRST-TIME UX: PASS  
MEMORY PHASE CLARITY: PASS  
MEMORY ERROR FEEDBACK: PASS  
MEMORY DIFFICULTY PACING: PASS  
MEMORY MULTIPLAYER UX: PASS  
MEMORY FINAL SCORE: 9.08/10

MOBILE UX: PASS  
PERFORMANCE AFTER POLISH: PASS  
REAL BROWSER UX REVIEW: PASS  
OVERALL 3-GAME UX: PASS

Các gate áp dụng cho phạm vi browser/heuristic đã mô tả, với average từng game ≥9.0 và mọi mục ≥8.5. Không suy rộng thành chứng nhận của người dùng độc lập hay thiết bị chưa thử.

## Giới hạn còn lại

Chưa có người mới độc lập tham gia user study, thiết bị iOS/Android vật lý hoặc thử bàn phím/UniKey cấp hệ điều hành. Browser native Unicode/composition và viewport thấp không thay thế các kiểm tra thiết bị đó. Những kết luận ở đây dựa trên Chromium thực và các tương tác/ảnh/phép đo lưu kèm. Không triển khai production trong phase này. Không thêm sound mới; phản hồi trực quan không phụ thuộc âm thanh.
