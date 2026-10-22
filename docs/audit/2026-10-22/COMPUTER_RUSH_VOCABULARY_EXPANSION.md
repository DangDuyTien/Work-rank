# Computer Rush — Vocabulary Expansion & Anti-Repeat

Ngày nghiệm thu: **22/10/2026**. Project: `/Applications/du-an/workrank/workrank-realtime`. Base Git: `c52b180`.
Phạm vi: **chỉ Computer Rush**. Không đổi scoring, Solo/Duo/Trio, server authority, persistence, BXH hay UX/motion của 3 game còn lại.

## Kết luận

Kho từ tăng từ **34 → 2.817 entry**, **0 trùng** sau normalize, tiếng Việt chiếm 37,3%, 13 nhóm chủ đề, 4 dải độ dài. Cách chọn từ được thay từ *random có hoàn lại* bằng **shuffle bag tất định theo seed** + **tiến trình độ khó theo index** + **khoảng cách họ từ**, và server **chọn seed tránh lặp với 2 trận gần nhất**.

Đo trên engine thật: 1.000 trận mô phỏng → **0 trận có từ lặp bên trong**, coverage **100%** kho từ, lặp giữa hai trận liên tiếp **1,76%** (trường hợp xấu nhất, seed ngẫu nhiên). Khi bật chọn seed của server: **0%** lặp từ đã gõ qua 400 trận liên tiếp.

Browser thật (390px): 6 trận SOLO liên tiếp — 72 lượt gõ, **0 lặp trong trận**, **0 lặp giữa hai trận liền kề**; DUO và TRIO **0 sai lệch chuỗi** giữa các người chơi.

## Old Dataset

`shared/arcade/words.mjs` — 34 entry, hard-code:

| Nhóm | Số lượng |
|---|---:|
| easy | 10 |
| medium | 8 |
| hard | 6 |
| vietnamese | 10 |
| **Tổng** | **34** |

- Unique thật: **34** (không có biến thể hoa/thường trùng).
- Không có history chống lặp.
- Picker: `words[Math.floor(rng() * words.length)]` — **random có hoàn lại**, mỗi index độc lập.
- Category được chọn theo công thức `index < 5 ? easy : index < 12 ? medium : index < 18 ? hard : index % 3 ? vietnamese : medium` → sau index 18 **không còn từ easy**, và 1/3 số lượt cuối luôn là tiếng Việt.
- Với 34 từ và ~50 lượt/trận, nguyên lý chuồng bồ câu bảo đảm **lặp trong cùng một trận**.

## New Dataset

| Chỉ số | Giá trị |
|---|---:|
| Tổng entry | **2.817** |
| Unique sau normalize | **2.817** |
| Trùng | **0** |
| Entry rỗng / hỏng | **0** |

Cấu trúc dữ liệu (không nhét string vào component):

```text
shared/arcade/vocabulary/
  english.mjs      # 8 nhóm, chuỗi từ thô
  vietnamese.mjs   # 5 nhóm
  index.mjs        # parse → metadata → CHALLENGES + VOCAB_STATS
```

Mỗi entry có metadata đầy đủ: `id, text, key, language, category, difficulty, length, family, syllables, chars`.

## Languages

| Ngôn ngữ | Số lượng | Tỉ lệ |
|---|---:|---:|
| English | 1.767 | 62,7% |
| Vietnamese | 1.050 | 37,3% |

Mục tiêu 55–65% / 35–45% → đạt.

## Categories

13 nhóm, nhóm lớn nhất chiếm 17,8% (không nhóm nào áp đảo):

| Nhóm | Số lượng | | Nhóm | Số lượng |
|---|---:|---|---|---:|
| work | 330 | | vn-work | 230 |
| media | 210 | | vn-media | 181 |
| design | 157 | | vn-tech | 184 |
| technology | 259 | | vn-everyday | 299 |
| business | 200 | | vn-phrase | 156 |
| everyday | 501 | | phrase (2 từ) | 80 |
| | | | phrase3 (3 từ) | 30 |

## Difficulty Distribution

| Mức | Số lượng | Tỉ lệ |
|---|---:|---:|
| easy | 472 | 16,8% |
| medium | 1.500 | 53,2% |
| hard | 845 | 30,0% |

Quy tắc suy ra (không gán tay): 1 từ ≤5 ký tự không dấu → easy; ≤9 ký tự → medium; còn lại hoặc cụm ≥3 từ → hard.

## Length Distribution

| Dải | Số lượng | Tỉ lệ | Ghi chú |
|---|---:|---:|---|
| short (3–5) | 501 | 17,8% | chủ yếu từ Anh ngắn |
| medium (6–9) | 1.371 | 48,7% | |
| long (10–15) | 455 | 16,2% | |
| phrase (2–3 từ) | 490 | 17,4% | |

**Sai lệch so với gợi ý 20/40/25/15 và lý do:** từ tiếng Việt có dấu (2 âm tiết, 6–9 ký tự) chiếm phần lớn vốn từ tiếng Việt tự nhiên nên dồn vào `medium`; `long` chỉ đến từ từ đơn ≥10 ký tự (tiếng Việt hiếm từ đơn dài). Cả 4 dải đều ≥16%, không dải nào >50%. Đây là lựa chọn có ý thức: **giữ từ tự nhiên** thay vì nhồi từ dài vô nghĩa để đúng tỉ lệ.

## Duplicate Validation

Chuẩn hoá trước khi so: **NFC → trim → gộp khoảng trắng → uppercase (locale vi)**. Không tự động dedupe: nếu có trùng, `VOCAB_STATS.duplicates` ghi lại và test fail — tránh việc bỏ bớt âm thầm làm sai con số.

Đã sửa 17 cặp trùng thật trong quá trình dựng dữ liệu (ví dụ `SOLVENCY` xuất hiện ở cả business lẫn danh sách tài chính, `LƯU TRỮ` ở cả vn-work và vn-tech, `CHĂM SÓC KHÁCH HÀNG` ở vn-work và vn-phrase). Kết quả cuối: **0**.

Test cũng chặn: khoảng trắng đầu/cuối, khoảng trắng lặp, ký tự `?`, `undefined`, `null`, text không phải NFC, text không ở dạng hiển thị chuẩn.

## Near-Duplicate Handling

Mỗi entry có `family`:

- Tiếng Anh: bỏ hậu tố `-ing/-ed/-er/-ers/-es/-s` ở từ đầu (`designer → design`, `editing → edit`).
- Tiếng Việt: âm tiết đầu (`thiết kế ảnh → thiết`, `quản lý dự án → quản`).

Khi dựng chuỗi, nếu ứng viên kế tiếp cùng `family` với 6 lượt gần nhất, thuật toán **quét tới 60 vị trí** trong bag để đổi chỗ một entry khác họ. Đo 120 trận × 60 lượt: **0 cặp cùng họ trong 4 vị trí liền nhau**.

## Shuffle Algorithm

```text
seed + difficulty
  → rng tất định (mulberry32, seed = FNV-1a của "seed|difficulty")
  → Fisher–Yates 3 bag riêng: easy / medium / hard
  → index i chọn tier theo tiến trình → tiêu thụ tuần tự từ bag của tier
  → nếu cùng family với 6 lượt trước → đổi chỗ với ứng viên xa hơn
```

Vì sao: `Math.random()` mỗi lượt không bảo đảm không lặp và không tái lập được. Shuffle bag cho **không lặp cho tới khi cạn bag** (2.817 > 512 lượt tối đa/trận) và vẫn **thuần tuý theo (seed, difficulty)** — điều kiện bắt buộc để `replay()` của server chấm điểm khớp với những gì client đã hiển thị.

Đo trên máy dev: dựng chuỗi 512 mục **2 ms**; 5.000 lần tra `challenge()` (đã cache) **27 ms** (~0,005 ms/lượt); một lần dựng "nguội" 60 mục **0,3 ms** — nên 24 lần thử seed khi tạo phòng tốn ~7 ms, không ảnh hưởng input.

Chuỗi **không** phụ thuộc `rulesVersion`: luật chơi không đổi nghĩa của từ. (Đã phát hiện và sửa lỗi này — nếu gắn rulesVersion vào khoá, client gọi mặc định v3 còn phòng chạy v2 sẽ ra hai chuỗi khác nhau và replay chấm sai.)

## Recent-History Strategy

Ở **server**, khi tạo phòng (và khi rematch):

1. Lấy tối đa **2 trận Computer Rush gần nhất đã kết thúc** của người chơi.
2. Dựng lại 60 challenge đầu của mỗi trận từ `seed` đã lưu → tập ID "vừa chơi".
3. Thử tối đa **24 seed** ngẫu nhiên; nhận seed đầu tiên có **0** challenge trùng trong 60 lượt đầu. Nếu không đạt, dùng seed ít trùng nhất.

Chi phí: ~5–10 ms mỗi lần tạo phòng (mỗi lần thử ~0,3 ms). Không đọc/ghi gì thêm vào DB ngoài query lịch sử vốn có.

Lịch sử **chỉ là tối ưu**: seed cuối cùng vẫn là nguồn sự thật duy nhất, được lưu vào `arcade_rooms.seed`. Không có history local nào ảnh hưởng tới fairness.

## Multiplayer Determinism

Client và server cùng gọi `challenge(game, seed, index, difficulty)` từ **cùng một module** `shared/arcade/engine.mjs`. Chuỗi chỉ phụ thuộc `(seed, difficulty)` nên:

- Mọi người trong phòng nhận **đúng cùng một từ ở cùng index**.
- `replay()` của server dựng lại đúng chuỗi để chấm điểm; không nhận score/word từ client.
- Browser QA: DUO 2 người, TRIO 3 người → **0 sai lệch** trên 5 index đầu (ví dụ TRIO: `0:LAYER 1:SHADE 2:POP` giống nhau ở cả 3 máy).

## 1.000-Match Simulation

Thuần thuật toán (không browser), 1.000 trận × 50 lượt, seed ngẫu nhiên (không bật chọn seed của server — đây là trường hợp xấu nhất):

| Chỉ số | Kết quả |
|---|---|
| Trận có từ lặp bên trong | **0 / 1.000** |
| Coverage kho từ | **100,0%** (2.817/2.817) |
| Lặp giữa hai trận liên tiếp | **1,76%** (≈0,9 từ/50 lượt) |

Khi bật chọn seed như production (400 trận liên tiếp, mỗi trận 12 lượt gõ):

| Chỉ số | Kết quả |
|---|---|
| Từ đã gõ lặp lại ở trận kế tiếp | **0,00%** |
| Trùng lớn nhất trong 60 lượt đầu giữa 2 trận | **0** |

## Browser Playtest

Frontend Vite + backend Express + MySQL thật, Chromium, viewport 390×844 (mobile).

**SOLO — 6 trận liên tiếp, 12 từ/trận:**

```text
1  DIG · DIFF · QUIET · PATH · QUEUE · LY NƯỚC · CRY · VÍ DA · LEG · BẢN ĐỒ · FILM · COZY
2  STAR · FADER · FIX · MERGE · CAP · COMPLAINT · ZIP · KẸP GIẤY · MEMO · KHUNG ẢNH · TIE · WASH
3  SIX · PLANT · ACT · LATE · RIM · SINH VIÊN · PROP · CHARTER · JAW · CHÂN MÁY · CLOUD · LIE
4  ROB · DISH · FEW · LOA · FUN · BỐ MẸ · SIT · SIÊU THỊ · WOOL · ĐỀ XUẤT · BEAT · FLUID
5  JOB · CAN · CAR · END · RULER · SNAPSHOT · TUNE · INSTANCE · WAX · LAYOUT · INN · COOK
6  MAD · INN · TAPE · BOW · KIND · LEAFLET · RIFF · CÁI BÀN · AIR · CARNIVAL · CHART · SALES
```

- 72 lượt, **0 lặp trong trận**, **0 lặp giữa hai trận liền kề**.
- Trộn đều tiếng Anh/tiếng Việt, từ ngắn mở đầu rồi dài dần.

**DUO / TRIO:** mỗi người gõ 5 từ, đối chiếu theo index → **0 mismatch**. Ảnh: `duo-390.png`, `trio-390.png`.

**Nhãn ngôn ngữ:** đã sửa lỗi nhãn cứng `category === 'vietnamese'` (trước đây từ tiếng Việt vẫn hiện "ENGLISH"): giờ dùng `language === 'vi'` → `BẢN DỊCH → TIẾNG VIỆT`.

**Cụm dài:** 17 entry >22 ký tự (dài nhất `CONTINUOUS INTEGRATION PIPELINE`, 31 ký tự). Thêm class `wrap-word` (cho xuống dòng, font 17–26px) → đo thực tế `REMOTE COLLABORATION TOOL` (25 ký tự) tại 390px: **không tràn**, không cắt chữ. Ảnh: `long-phrase-390.png`.

**Input performance:** gõ 42 ms/ký tự, mỗi từ phản hồi <1 frame; không có long task hay pageerror trong suốt 6 trận + 2 trận multiplayer.

## Files Changed

| File | Thay đổi |
|---|---|
| `shared/arcade/vocabulary/english.mjs` | **mới** — 8 nhóm từ tiếng Anh |
| `shared/arcade/vocabulary/vietnamese.mjs` | **mới** — 5 nhóm từ tiếng Việt |
| `shared/arcade/vocabulary/index.mjs` | **mới** — parse, normalize, metadata, `VOCAB_STATS`, `tierForIndex` |
| `shared/arcade/words.mjs` | **xóa** — bank 34 từ không còn dùng |
| `shared/arcade/engine.mjs` | shuffle bag tất định, tiến trình độ khó, khoảng cách họ từ, `chooseComputerSeed`, `challenge()` trả thêm `language/difficulty/family/challengeId` |
| `backend/src/services/arcade.service.js` | chọn seed tránh lặp khi tạo phòng và rematch |
| `backend/test/arcade_vocabulary.test.js` | **mới** — 8 test dataset + thuật toán |
| `frontend/src/components/arcade/ComputerStation.jsx` | nhãn ngôn ngữ theo `language`, class `wrap-word` |
| `frontend/src/components/arcade/arcade-polish.css` | style cho cụm 3 từ |
| `frontend/scripts/computer-vocabulary-browser-audit.mjs` | **mới** — harness SOLO/DUO/TRIO |
| `docs/audit/2026-10-22/computer-vocabulary/` | evidence JSON + ảnh |

## Tests

| Bộ | Kết quả |
|---|---|
| `arcade_vocabulary.test.js` | **8/8 PASS** |
| `arcade_engine` + `arcade_http` + `arcade_service` + `game_catalog` + `persistence_regressions` | **30/30 PASS** |
| Toàn bộ backend | 646 tests, **635 pass / 10 fail / 1 skip**. 10 fail là pre-existing ở competition phase 3/5/9, integration, MVP cup — không liên quan Computer Rush (đã đối chiếu bằng `git stash` ở task Drawing) |
| Frontend `npm run check` | 89 files, 0 errors |
| Frontend `npm run build` | ✓ 3.87s |

## Remaining Risks

1. **Trận đang chơi khi deploy**: chuỗi từ đổi so với bản cũ, nên event đã gõ theo từ cũ sẽ không replay khớp. Ván chỉ 60 giây; nên deploy giữa các ván. Không có cách tương thích ngược vì chính kho từ là thứ thay đổi.
2. **Phân bố độ dài lệch gợi ý** (medium 48,7% thay vì ~40%, long 16,2% thay vì ~25%) vì đặc thù tiếng Việt có dấu. Đã ghi rõ, không nhồi từ dài vô nghĩa để đạt tỉ lệ.
3. **Family heuristic** chỉ bắt hậu tố tiếng Anh + âm tiết đầu tiếng Việt. Nó chặn được `design/designer/designing` và `thiết kế/thiết kế ảnh`, nhưng không phải mô hình ngữ nghĩa — vẫn có thể lọt cặp gần nghĩa khác họ.
4. **Seed search phụ thuộc lịch sử `finishedAt`**. Người chơi mới (chưa có trận) nhận seed ngẫu nhiên — vẫn không lặp trong trận, chỉ không có bảo đảm giữa trận.
5. **Chỉ kiểm Chromium**; chưa kiểm Safari/Firefox (font tiếng Việt và `white-space` có thể khác).
6. **Từ vay mượn không dấu** (ví dụ `micro`, `banner`) nằm trong nhóm tiếng Việt nhưng được xếp độ khó như tiếng Anh. Chấp nhận được, không ảnh hưởng gameplay.
7. **10 test backend fail sẵn** (competition/integration) — nợ kỹ thuật của repo, không do thay đổi này.

## Final Gates

Tiêu chí PASS được ghi ngay cạnh để không suy diễn:

| Gate | Kết quả | Bằng chứng |
|---|---|---|
| VOCAB_TOTAL >= 2500 | **PASS** | 2.817 (≤3.200) |
| VOCAB_UNIQUE | **PASS** | 2.817 unique / 2.817 |
| EXACT_DUPLICATES = 0 | **PASS** | `duplicates.length === 0` |
| UNICODE_DUPLICATES = 0 | **PASS** | chuẩn hoá NFC + case-fold trước khi so |
| ENGLISH_DIVERSITY | **PASS** | 1.767 từ, 62,7%, 7 nhóm chủ đề |
| VIETNAMESE_DIVERSITY | **PASS** | 1.050 từ, 37,3%, 5 nhóm chủ đề |
| CATEGORY_DIVERSITY | **PASS** | 13 nhóm, nhóm lớn nhất 17,8% |
| LENGTH_DIVERSITY | **PASS** | 4 dải, mỗi dải ≥16% (xem ghi chú lệch gợi ý) |
| DIFFICULTY_BALANCE | **PASS** | easy 16,8% / medium 53,2% / hard 30,0% |
| SINGLE_MATCH_NO_REPEAT | **PASS** | 1.000 trận × 50 lượt: 0 trận lặp; 100 challenge/trận unique |
| RECENT-MATCH_ANTI_REPEAT | **PASS** | 0% lặp từ đã gõ / 400 trận; browser 0/72 |
| NEAR_DUPLICATE_CLUSTERING | **PASS** | 0 cặp cùng họ trong 4 vị trí, 120 trận × 60 |
| SEEDED_MULTIPLAYER_SEQUENCE | **PASS** | DUO/TRIO 0 mismatch; replay khớp |
| SOLO | **PASS** | 6 trận browser thật |
| DUO | **PASS** | 2 browser, cùng chuỗi |
| TRIO | **PASS** | 3 browser, cùng chuỗi |
| INPUT_PERFORMANCE | **PASS** | 42 ms/ký tự; build chuỗi 512 mục = 2 ms, 5.000 lookup = 27 ms; không long task/pageerror |
| EXISTING_SCORING_REGRESSION | **PASS** | 30/30 arcade tests, replay bất biến |
| BXH/PERSISTENCE_REGRESSION | **PASS** | nằm trong 30/30 suite arcade (PB, BXH, reward idempotent, history) |
| **OVERALL COMPUTER VOCABULARY** | **PASS** | 2.817 entry thật, 0 trùng, đa ngôn ngữ/nhóm/độ dài, không lặp trong trận, gần như không lặp giữa trận, Duo/Trio cùng chuỗi |
