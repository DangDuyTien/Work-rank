# Typing Battle — Re-audit và remediation 2026-10-19

Phạm vi: Typing Battle và practice, API, Socket.IO, DB, input, vị trí gõ, metrics, BXH, rewards, reload/reconnect. Kiểm tra mới trên Chromium với frontend Vite thật, Express thật, Socket.IO thật và SQLite `:memory:` độc lập. Không dùng `page.route`, socket giả hoặc cờ bypass auth cho acceptance. Các phiên dùng tài khoản fixture và token do endpoint đăng nhập thật cấp. Không sử dụng DB phát triển/sản xuất hay ghi token vào bằng chứng.

Bản báo cáo ngày 2026-10-18 được giữ nguyên. PASS của Typing trong môi trường này không chuyển release toàn WorkRank sang GO.

## ROOT CAUSES

1. **Native caret:** ô input ẩn rộng 1px gây lỗi Chromium `insertText` với tiếng Việt: chuỗi `abcdef vị trí hiện` bị chèn tiếp từ vị trí 0 sau chữ có dấu. Tái hiện trên cả game và input HTML thuần. Đổi sang input trong suốt có chiều rộng thực; giữ caret/composition do browser quản lý.
2. **Khôi phục state chen ngang input:** callback đặt selection trễ 100ms dùng độ dài draft cũ, và callback reconnect giữ closure trạng thái WAITING. Một cái chuyển caret khi đang gõ, một cái không gửi lại draft mới.
3. **Ranh giới tin cậy practice:** endpoint cũ nhận WPM/accuracy/duration client và mỗi lần gọi có thể thưởng lại. Baseline HTTP thật gửi WPM 249, elapsed 0, duration 120 hai lần vẫn ghi thành tích và XP. Thay bằng server-issued attempt, timestamps, text, revision và transaction.
4. **Metric/rank:** live payload không có rank/hiệu suất đủ dùng; vài nhãn dẫn đầu lại dựa vào số từ/progress. WPM timeout có thể là snapshot tốc độ cũ thay vì thời gian cuối trận; bestWpm cũ không chứng minh được nguồn hợp lệ.
5. **Render/layout:** thay font-weight/padding theo đúng/sai làm đổi chiều rộng; dựng danh sách toàn bộ đoạn dài theo từng phím; grid min-content đẩy card ra ngoài 390px nhưng app shell che overflow nên chỉ đo scrollWidth không phát hiện được.
6. **Vòng đời trận/đồng hồ:** interval frontend phụ thuộc typedText bị tạo lại theo phím; idempotency chỉ theo room/user trùng giữa hai ván cùng phòng; input muộn có thể làm thay đổi kết quả sau deadline; làm tròn thời gian server quá ngắn lên 1 giây có thể biến lượt tức thời thành hợp lệ.

## BUGS FOUND

| ID | Severity | Problem / bằng chứng | Root cause | Fix / verification |
|---|---|---|---|---|
| TB-001 | P1 | Tiếng Việt làm native selection về 0; đã tái hiện bằng HTML thuần và game | Input rộng 1px | Input đủ rộng, native caret; browser pace + IME |
| TB-002 | P1 | Draft restore đặt caret cũ giữa lúc đang gõ | setSelectionRange trong timeout | Bỏ selection trễ; DOM chỉ được ghi khi reset/restore thật |
| TB-003 | P1 | Practice fake metrics được ghi nhận, elapsed 0 vẫn có XP | Tin số liệu client | Attempt server, server clock và so khớp text |
| TB-004 | P1 | Retry practice có thể thưởng nhiều lần | Không có identity ổn định của lượt | UUID attempt + row lock + FINISHED result + ledger key, cùng transaction |
| TB-005 | P1 | bestWpm cũ có thể là số bị exploit | Đọc cached stat không kiểm chứng nguồn | Chỉ dùng result metricVersion=2 hợp lệ; đánh dấu lịch sử chưa xác minh |
| TB-006 | P1 | Live rank thiếu, nhãn dẫn đầu dùng tốc độ/progress thô | Contract giữa server/socket/UI chưa đủ | Server liveRank + performance; frontend hiển thị rank server |
| TB-007 | P1 | Timeout phải đo lại tốc độ tại deadline trước winner | Snapshot progress không phải final duration | Đo lại draft ở deadline, eligibility → ranking → winner → rewards |
| TB-008 | P1 | Ván mới cùng room có thể bị ledger key của ván trước chặn | Key room/user thiếu identity ván | Key thêm server startedAt; test rematch, result mới, retry không lặp |
| TB-009 | P2 | Không rõ character/word/line, caret mảnh và nháy | Tracking thiếu hierarchy | Marker nền + underline + caret tĩnh, word highlight, chỉ số dòng |
| TB-010 | P2 | Đúng/sai đổi bề rộng; đoạn dài render nặng | Font/padding thay đổi, diff danh sách toàn đoạn | Font cố định; memo theo block 32 từ; profile CPU thật |
| TB-011 | P2 | Vùng gõ bị cắt ngang ở 390px | Grid min-content + overflow app shell | minmax(0,1fr), min-width:0; test cả rect ngang/dọc; input neo tại vùng gõ |
| TB-012 | P1 | Gõ liên tục có thể trì hoãn interval countdown | Effect phụ thuộc text theo từng phím | Timer đọc ref; server clock được neo một lần |
| TB-013 | P1 | Reconnect không flush draft mới | Closure WAITING | Join ack gửi text/revision mới nhất; stale snapshot không ghi đè |
| TB-014 | P2 | Chưa có dữ liệu vẫn hiển thị accuracy 100%; nhãn số từ/câu sai nghĩa | Fallback và nhãn UI | Zero là 0%; từ quy đổi 5 ký tự; bỏ câu luôn bằng 0 |
| TB-015 | P2 | Spectator không có bảng rank chung | Bảng chỉ trong vùng nhập của player | Bảng server dùng chung cả spectator/player; không mở quyền nhập |
| TB-016 | P2 | Idle làm số live đứng yên | Chỉ broadcast khi có progress | Server pulse 1 giây; socket coalesce 120ms; cleanup khi chốt |
| TB-017 | P1 | Bỏ AFK khỏi mẫu số có lợi cho team không tham gia | Trung bình chỉ trên người eligible | AFK/invalid góp 0 trong tổng quân số đội |
| TB-018 | P1 | Input muộn sau deadline có thể tăng kết quả | Không khóa theo server deadline | Ignore progress muộn; finish quá grace dùng draft đã lưu |
| TB-019 | P1 | Server elapsed 1ms bị nâng lên 1s và có thể thưởng 20 ký tự | Clamp che thời gian bất hợp lệ | Reject server run <1s; unit và adversarial HTTP |
| TB-020 | P2 | Từ IME đầu tiên không có thời gian composition trên server | Clock chỉ bắt đầu lúc commit text | Composition start mở server clock, không nhận timestamp client |

Tổng nhóm lỗi: **20** (P0=0, P1=13, P2=7, P3=0). Đây là nhóm remediation mới trong phạm vi Typing, không cộng gộp với audit lịch sử. Một số được tái hiện trên browser/HTTP, số khác xác nhận bằng source và regression độc lập; không giả định mọi lỗi đã có browser reproduction baseline.

## INPUT ARCHITECTURE

`native input/composition → NFC text ref + revision → React highlight tức thời → draft theo user/room hoặc attempt → network coalesce 120ms → server kiểm text/revision/thời gian → public metrics/rank → UI`.

Không throttle/debounce input nguồn. Input native giữ caret và composition; layout effect chỉ gán DOM khi có reset hoặc draft restore khác nội dung thật. Unicode so sánh theo code point sau NFC, không dùng UTF-16 length cho metrics. Trong composition chưa hoàn tất không gửi text trung gian như kết quả chính thức. Ngăn paste/drop; server vẫn tự xác minh và không coi ngăn paste ở frontend là bằng chứng chống cheat đầy đủ.

Snapshot cũ không được dựng lại text đúng từ typedChars. Chỉ chủ draft nhận nội dung của mình; spectator chỉ nhận số liệu công khai. Reconnect flush revision mới, kể cả text trống sau Backspace.

## CURRENT POSITION UX

- Character hiện tại: background, underline 3px và caret tĩnh, không cần blink để nhận ra.
- Word hiện tại: nền nhẹ; chữ đã gõ đúng giảm nhấn; sai là đỏ + underline, không chỉ dựa màu.
- Header hiển thị character, word, line; viewport 160px giữ current line gần giữa khi đi qua dòng.
- Font/weight/padding cố định giữa các trạng thái. Auto-scroll đổi khi cần giữ marker trong vùng đọc; không animate layout theo phím.
- Memo block 32 từ giới hạn công việc reconcile; BXH là component memo riêng, không cập nhật nguồn input theo network.
- Mobile 390/430/768 đo cả bounding rect ngang/dọc, không chỉ `document.scrollWidth`. Input neo tại vùng đọc để focus không kéo về đầu card.

## METRIC CONTRACT

Ký hiệu `N` = số code point NFC hiện giữ trong text, `E` = số vị trí sai hiện tại, `C=N−E`, `T` = server elapsed milliseconds giới hạn theo deadline, `L` = chiều dài challenge.

| Metric | Formula | Authority | Update | UI label |
|---|---|---|---|---|
| Typed chars | N | Server; UI dự đoán từ input | input / progress | Ký tự |
| Current incorrect chars | E, so khớp từng vị trí, bỏ phân biệt hoa/thường | Server; UI dùng cùng semantics | input / progress | Lỗi sai |
| Correct chars | max(0,N−E) | Server | progress/final | Dùng tính WPM |
| Raw WPM | (N/5)/(T/60000) | Server | progress/final | Lưu riêng, không quyết định rank |
| Net WPM | (C/5)/(T/60000), 1 decimal; invalid thì 0 | Server | progress/pulse/final | WPM hiệu dụng |
| Accuracy | N>0 ? round(C/N×100,1) : 0 | Server | progress/final; UI phản hồi local | Chính xác |
| Progress | min(100,N/L×100), 1 decimal | Server | progress/pulse/final | Tiến độ, không đồng nghĩa đúng |
| Completion | N≥ceil(0.9L) | Server | progress/final | Hoàn thành |
| Elapsed | Server now−server startedAt, không nhận client duration | Server | timer/progress/final | Thời gian |
| Performance | max(0,(0.6×WPM+40×accuracy/100+completionBonus−1.5×E)×difficulty), 1 decimal; bonus=20 nếu completed | Server | live/final | Hiệu suất |
| Eligibility | ≥20 chars, thời gian/giới hạn hợp lệ, performance>0, không invalid | Server | live/final | Hạng hoặc — |
| Rank | Eligibility → completion → performance → accuracy → net WPM → duration → user ID | Server | pulse/final | Hạng tạm thời / chính thức |
| Từ quy đổi | N/5 | UI từ text | input | Từ quy đổi (5 ký tự) |
| Practice XP | Chỉ recorded; min(40,max(5,round(WPM×accuracy/100×durationMinutes/10))) | Server | transaction finish | XP được ghi nhận |
| Match XP | Engine hiện tại, match type, eligible, winner/draw và daily diminishing/cap | Server | atomic finalization | Điểm WorkRank |

Accuracy là **độ đúng của text hiện đang giữ**, đúng product rule hiện tại: sai rồi Backspace sửa có thể trở lại 100%. Không tuyên bố đây là accuracy toàn bộ quá trình nhấn phím. `totalMistakes` / `correctedMistakes` chưa được thu thập đáng tin nên không dựng ra số giả. UI tốc độ khi đang nhập là dự đoán cục bộ theo cùng công thức; rank/final/reward luôn dùng số server.

## LIVE LEADERBOARD RULE

Server tính net WPM, quality/performance và eligibility từ draft + thời gian server. Broadcast ngay sau progress và pulse khoảng 1 giây khi idle, gom socket tối đa cadence 120ms. Server trả `liveRank`; UI chỉ sắp theo rank này, không sort lại theo raw WPM hoặc quãng đường. Highlight người hiện tại, rank không hợp lệ là `—`. Nhãn dẫn đầu cá nhân dùng server rank; team dùng trung bình performance của đầy đủ đội hình, người AFK/invalid góp 0.

## FINAL LEADERBOARD RULE

Thứ tự: settle các player đang TYPING tại deadline → đo metrics cuối → eligibility → comparator server → rank → winner → ledger/stat/result transaction. Kết quả bất biến được tải lại khi refresh; không dùng snapshot result ván trước khi room reset. Frontend hiển thị `individualRank`, `winnerUserId`/`winnerTeam`; không phong người đầu mảng làm winner cho trận AFK. Retry và simultaneous finish được claim một lần. Ván mới cùng room có ledger key theo startedAt của ván mới.

## PRACTICE SECURITY

Thêm `typing_practice_attempts` và migration tương ứng. Server chọn challenge, whitelist duration, tạo UUID attempt, giữ draft/revision/start/finish/result. Owner check dùng attempt ID **và** user ID. Client chỉ gửi text/revision và yêu cầu thao tác, không quyết định WPM, accuracy, duration, score hay XP. Không trả authority cho `clientDurationMs`.

Chỉ lượt đủ ít nhất 120 giây theo server, eligible, valid mới ghi Best/BXH và XP. 30/60 giây vẫn luyện được nhưng không ghi reward. FINISHED attempt trả lại cùng result; khóa attempt/stat và ledger key `typing_practice_attempt:<uuid>` trong cùng transaction. Input muộn quá grace không được bổ sung text mới. Tăng text vượt khả năng giữa các lần sync bị đánh invalid; composition có clock server từ lúc bắt đầu.

BXH và Best WPM lấy từ result đã xác minh `metricVersion=2`; cached best cũ không được làm nguồn authority. Nếu cached cũ lớn hơn verified best, API/UI báo lịch sử chưa xác minh.

> **Cập nhật 2026-10-19 (xem `TYPING_SOLO_LOCAL_FIRST_REMEDIATION.md`):** `metricVersion=2` ở đây là bug — metric hiện tại là v3. Filter verified và result trận đã sửa dùng `METRIC_VERSION`; result v2 cũ bị coi là chưa xác minh (đúng chính sách), cần thông báo product trước khi release. **XP và trung bình lịch sử cũ chưa được backfill/thu hồi**; cần audit dữ liệu sản xuất riêng trước khi hiệu chỉnh ledger bất biến. Không xóa hoặc reverse điểm lịch sử trong đợt này.

Anti-cheat là kiểm tra plausibility và server-time, không thể chứng minh một client tùy biến là con người chỉ từ text hợp lệ gửi đúng nhịp. Không tuyên bố chống bot tuyệt đối.

## FILES CHANGED

<!-- FILES -->

## AUTOMATED TESTS

<!-- AUTOMATED -->

## REAL BROWSER TEST

<!-- BROWSER -->

## PERFORMANCE RESULT

<!-- PERFORMANCE -->

## REMAINING ISSUES

- Hồi quy toàn sản phẩm chưa xanh. Xem đối chứng HEAD trong `typing/regression-reconciliation.json`; không che failures hoặc đổi test để báo PASS.
- Route smoke cũ 19/20: vẫn yêu cầu `CapitalBoardGame.jsx` đã bị gỡ. Shared socket-room suite cũng tham chiếu `GameRoom` không còn export, khiến 8 test bị cancelled trước khi chạy. Các test Typing socket riêng và full-stack thật được chạy độc lập.
- Warnings có trước ở `Friends.jsx` (duplicate object properties) và CSS `Unexpected @media`; production build vẫn thành công. Chưa thay đổi các vùng ngoài Typing để làm sạch cảnh báo.
- Chưa chạy MySQL/PostgreSQL, migration trên DB thật hoặc backfill sản xuất. SQLite transaction queue chỉ áp dụng SQLite; DB mạng dùng transaction/row lock bình thường.
- Browser acceptance là Chromium headless trên máy này; chưa thử thiết bị iOS/Android thật, bàn phím IME của OS, WebKit/Firefox, screen reader, load nhiều phòng hoặc soak dài. Chromium native composition đã thử thật qua CDP; không coi đó là chứng nhận mọi bộ gõ hệ điều hành.
- Verified leaderboard hiện quét result JSON. Cần projection/index phù hợp nếu lịch sử rất lớn; không có claim benchmark tải sản xuất.
- Không commit, deploy, hoặc sửa dữ liệu người dùng thật. Trước triển khai cần áp dụng migration mới theo quy trình repo.

## FINAL GATE

<!-- GATES -->
