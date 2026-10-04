---
name: smooth-motion
description: Chuẩn animation mượt, không nháy của WorkRank (React 18 + CSS token trong frontend/src/index.css + component trong frontend/src/components/ui.jsx). BẮT BUỘC đọc trước khi tạo/sửa bất kỳ UI nào có chuyển tab, chuyển chế độ form (login/đăng ký), chuyển trang, modal, drawer, dropdown, collapse, list/bảng xếp hạng, số đếm hoặc loading.
---

# Smooth Motion – WorkRank

Mẫu chuẩn là trang **Đăng nhập ⇄ Đăng ký** (`frontend/src/pages/Login.jsx`): bấm tab thì form đổi mượt, không nháy, không giật layout, không mất chữ đã nhập. Mọi phần khác phải làm theo đúng tinh thần đó, **dùng lại thứ có sẵn, không tự chế**.

## 1. Chỉ dùng token có sẵn (`frontend/src/index.css`, `:root`)

| Việc | Duration | Easing |
| --- | --- | --- |
| hover, press, icon | `var(--motion-fast)` 180ms | `var(--ease-standard)` |
| tab, dropdown, accordion | `var(--motion-normal)` 260ms | `var(--ease-spring)` |
| sidebar, panel, layout | `var(--motion-layout)` 340ms | `var(--ease-spring)` |
| drawer, thay đổi lớn | `var(--motion-slow)` 420ms | `var(--ease-emphasized)` |
| đóng/ẩn | ngắn hơn mở | `var(--ease-exit)` |
| xếp hạng đổi vị trí | `var(--motion-ranking-row)` | `var(--ease-ranking)` |

Không hard-code `0.2s ease`, không tạo token mới, không thêm thư viện animation (framer-motion, gsap…).

## 2. Dùng component có sẵn (`frontend/src/components/ui.jsx`)

| Cần | Dùng |
| --- | --- |
| Đổi nội dung tab | `<TabTransition key={activeTab} minHeight={420}>` – **bắt buộc `key`** (không phải `tabKey`), `minHeight` ≈ chiều cao nội dung để không giật |
| Mở/đóng vùng (height 0 ↔ auto) | `<AnimatedCollapse isOpen={open}>` |
| Modal | `<AnimatedModal isOpen onClose title>` (đã có enter + exit, Esc) |
| Số điểm/XP thay đổi | `<AnimatedNumber value={n} duration={700} />` |
| Bảng/list xếp hạng đổi thứ tự | `<FlipTableBody>` / `<FlipList>` với `key` = id ổn định |
| List xuất hiện lần lượt | `<AnimatedList>` + `<AnimatedListItem index={i}>` |
| Nội dung hiện dần khi load | `<Reveal delay={300}>` — fade + trượt lên, `delay` để xếp lần lượt. Dùng `since={mountTime}` cho dữ liệu API đến muộn |
| Nội dung hiện dần khi cuộn tới | `<Reveal mode="scroll">` — CSS scroll-driven, không JS listener |
| Chữ tiêu đề hero chạy từng ký tự | `<RevealText as="h1" text="…" delay={120} step={45} />` |
| Chờ tải | `Skeleton`, `CardSkeleton`, `TableSkeleton` (đúng kích thước nội dung thật) |
| Nút chọn nhóm nhỏ | `<SegmentedControl>` |

Class CSS có sẵn: `motion-fade-in-up`, `motion-fade-in`, `motion-slide-down` (thông báo/lỗi), `motion-hover-lift` (card), `motion-reveal` (fade+trượt khi load), `motion-reveal-char` (từng chữ), `motion-scroll-reveal` (hiện khi cuộn), `drawer-slide-enter/exit`, `drawer-slide-right-enter/exit`, `dropdown-exit`, `motion-toast-enter/exit`.

Chuyển trang đã xử lý sẵn trong `Layout.jsx` (`<PageTransition key={location.pathname}>`) → **không** bọc thêm PageTransition trong từng page.

## 3. Mẫu Login/Đăng ký (copy cách này cho form nhiều chế độ)

```jsx
// 1 form duy nhất, field dùng chung (email, mật khẩu) LUÔN mounted → không nháy, không mất input
<form className="public-auth-fields">
  {/* Field chỉ có ở chế độ Đăng ký: gập/mở bằng grid-template-rows, KHÔNG dùng {isRegister && ...} */}
  <div className={`public-auth-field-collapse ${isRegister ? 'is-open' : ''}`}
       aria-hidden={!isRegister} inert={!isRegister ? '' : undefined}>
    <fieldset disabled={!isRegister} className="public-auth-field-inner">…</fieldset>
  </div>
  {/* email, password dùng chung */}
</form>
```

- Tab chỉ đổi class/state (`aria-pressed`), transition `background-color, color, border-color, box-shadow` – không remount.
- Đồng bộ URL bằng `navigate({ search }, { replace: true })` để không thêm history và không reload.
- Tiêu đề có vùng `min-height` cố định (`.public-auth-form-heading`) để đổi chữ không đẩy layout.
- Thông báo/lỗi xuất hiện bằng `motion-slide-down`.

## 4. Luật chống nháy / giật

1. Chỉ animate `transform`, `opacity` (ngoại lệ: `grid-template-rows` cho collapse). Cấm `transition: all`; cấm animate `width/height/top/left/margin`.
2. Form đổi chế độ → giữ mounted + collapse (mục 3). Nội dung tab khác hẳn nhau → `TabTransition key`.
3. Không đổi `key` của component cha/chart chỉ vì filter/sort đổi (gây remount, mất hover/state).
4. Có dữ liệu cache (`useCachedData`) thì không hiện lại skeleton.
5. Điều hướng commit ngay; không `setTimeout` chờ animation, không giữ trang cũ.
6. Phần tử bị ẩn nhưng còn mounted phải có `inert` + `aria-hidden` (và `fieldset disabled` nếu là input).
7. RAF/timer/listener/socket phải cleanup khi unmount; `socket.off(event, callback)` luôn truyền callback.
8. Hạn chế `backdrop-filter`, `filter: blur`, shadow lớn; `will-change` chỉ đặt khi đang animate.
9. Tôn trọng giảm chuyển động: đã có sẵn `html[data-workrank-reduce-motion="true"]` và `prefers-reduced-motion` – CSS mới có keyframes riêng thì thêm nhánh tắt tương ứng; JS animation phải kiểm tra như `AnimatedNumber`.

## 5. Kiểm tra trước khi báo xong

- Bấm đổi tab/chế độ liên tục thật nhanh: không nháy trắng, không giật chiều cao, input còn nguyên.
- Back/Forward và reload: không flash, scroll đúng.
- Bật Settings → giảm chuyển động: vẫn dùng được.
- Chạy trong `workrank-realtime/frontend`: `npm run check` và `npm run build` phải pass.
- Khi có giật: `TÁI HIỆN → PROFILE (DevTools Performance/React Profiler) → TÌM GỐC → SỬA → TEST LẠI`. Không kéo dài duration để che lag, không tắt animation đại trà.
