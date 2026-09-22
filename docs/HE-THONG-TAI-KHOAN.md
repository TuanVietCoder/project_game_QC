# Hệ thống tài khoản Ashfall — tài liệu kiến trúc

> **Đọc file này trước khi sửa bất cứ thứ gì liên quan tới đăng nhập, bạn bè hoặc
> tin nhắn.** Tài liệu ghi lại *vì sao* mọi thứ được làm như vậy, không chỉ *cái gì*
> đã được làm — phần "vì sao" mới là thứ dễ mất và tốn tiền nhất khi làm lại.
>
> Cập nhật lần cuối: 21/09/2026 · Trạng thái: xong đợt 1–4

---

## 1. Bức tranh tổng thể

```
   Godot (game)  ─┐
                  ├──→  Supabase  ──→  PostgreSQL
   Web tĩnh      ─┘     (auth · realtime · RLS)
   ashfall.io.vn
   GitHub Pages
```

Website là **HTML/CSS/JS thuần**, không có bước build, không có framework, host trên
GitHub Pages. Vì GitHub Pages không chạy được code phía máy chủ nên không thể nối
thẳng vào database — **Supabase** đứng giữa lo phần đăng nhập, dữ liệu và cập nhật
tức thời.

**Project Supabase:** `bvpuxsywjnlisbrzhboz` (vùng Asia-Pacific, gói free)

### Nguyên tắc số một

> Khóa `anon` nằm công khai trong `assets/js/auth.js`. **Đó là đúng thiết kế.**
> Mọi lớp bảo vệ nằm ở **Row Level Security trong database**, không nằm ở JavaScript.
> Người dùng sửa được mã nguồn trang web, nhưng không sửa được luật trong Postgres.

Hệ quả bắt buộc:

- **Mọi bảng phải bật RLS.** Không có ngoại lệ.
- **Không bao giờ** đưa `service_role key` vào web tĩnh — khóa đó bỏ qua mọi RLS.
- Mọi kiểm tra quan trọng (ai được nhắn ai, ai được đổi quyền) phải nằm ở
  **policy hoặc trigger**, không phải ở `if` trong JavaScript.

---

## 2. Bản đồ file

| File | Vai trò |
|---|---|
| `supabase/schema.sql` | Bảng `profiles` — nền tảng của mọi thứ |
| `supabase/friends.sql` | Bảng `friendships` + các hàm tìm kiếm / kết bạn |
| `supabase/hardening.sql` | Siết quyền gọi hàm (xem §6) |
| `supabase/fix-tim-kiem.sql` | Vá lỗi `NOT NULL` trong tìm kiếm (xem §7.1) |
| `supabase/chat.sql` | Bảng `messages` + `reports` |
| `supabase/admin.sql` | Phân quyền kiểm duyệt, nhật ký, các hàm quản trị |
| `supabase/fix-quyen-admin.sql` | Vá lỗi `NULL` trong kiểm tra quyền (xem §7.4) |
| `supabase/anh-dai-dien.sql` | Bucket `avatars` + quyền ghi vào thư mục của chính mình |
| `assets/js/auth.js` | Client Supabase, `getProfile()`, gắn trạng thái đăng nhập vào nav |
| `assets/js/chat.js` | Widget chat nổi, tự gắn vào mọi trang |
| `assets/js/app.js` | Khung khu vực đăng nhập: `dungKhung()`, thanh trên, menu, cột bạn bè |
| `assets/css/base.css` | Token màu + reset + nav dùng chung |
| `assets/css/app.css` | Phần nhìn của khung đăng nhập (xem §2b) |
| `dang-nhap.html` | Đăng ký / đăng nhập → vào thẳng `trang-chu.html` |
| `trang-chu.html` | Trang chính sau khi đăng nhập |
| `tools/phienban.js` | Đánh số phiên bản cho JS/CSS (xem §2c) |
| `ho-so.html` | Hồ sơ cá nhân, sửa tên hiển thị / ảnh / giới thiệu |
| `ban-be.html` | Tìm người, gửi/nhận lời mời, chặn |
| `quan-tri.html` | Trang quản trị: báo cáo, người dùng, nhật ký |
| `chinh-sach-bao-mat.html` | Bắt buộc theo Nghị định 13/2023/NĐ-CP |

**Thứ tự chạy SQL** (khi dựng lại từ đầu):

```
schema.sql → friends.sql → hardening.sql → fix-tim-kiem.sql → chat.sql
→ admin.sql → fix-quyen-admin.sql → anh-dai-dien.sql
```

> `fix-tim-kiem.sql` ghi đè hàm trong `friends.sql`. Nếu gộp file sau này, nhớ giữ
> phiên bản trong `fix-tim-kiem.sql` — đó mới là bản đúng.

### Cách chạy SQL nhanh (đã dùng nhiều lần, hoạt động tốt)

Mở `supabase.com/dashboard/project/bvpuxsywjnlisbrzhboz/sql/new`, rồi nạp thẳng
file từ GitHub vào editor bằng console trình duyệt:

```js
const sql = await fetch('https://raw.githubusercontent.com/TuanVietCoder/project_game_QC/main/supabase/chat.sql')
  .then(r => r.text());
monaco.editor.getModels()[0].setValue(sql);
```

Bấm Run. Supabase sẽ cảnh báo *"Potential issue detected"* vì các file có
`drop ... if exists` — đó chỉ là phần dọn dẹp để chạy lại được nhiều lần, bấm
**Run query** là an toàn.

---

## 2b. Khung khu vực đăng nhập

Bốn trang cần đăng nhập — `trang-chu`, `ho-so`, `ban-be`, `quan-tri` — dùng chung
một khung kiểu Facebook. Trang không tự viết lại thanh điều hướng, mà gọi:

```js
import { dungKhung, el, hangNguoi, moChat } from './assets/js/app.js';
const { main, me } = await dungKhung('ban-be');   // mã trang, để tô sáng mục menu
```

`dungKhung()` lo hết: chưa đăng nhập thì tự chuyển sang `dang-nhap.html`, dựng
thanh trên (logo + ảnh đại diện có thực đơn thả xuống), menu bên trái, cột bạn bè
bên phải, rồi trả về phần tử cột giữa để trang tự đổ nội dung vào.

Ba cột ở màn rộng; ≤1080px bỏ cột phải; ≤760px menu rơi xuống thành thanh tab
dưới đáy như ứng dụng điện thoại.

**Chỉ gọi `danh_sach_ban()` MỘT lần** cho cả cột phải lẫn con số lời mời trên
menu. Nếu thêm thứ khác cần danh sách bạn, dùng lại kết quả đó, đừng gọi thêm.

Trang khác muốn mở khung chat với ai thì gọi `moChat(banId)`; nó bắn sự kiện
`ashfall:mo-chat` mà `chat.js` đang lắng nghe. Hai file không nhập lẫn nhau.

Trang `quan-tri.html` giữ nguyên ruột cũ: nó gọi `dungKhung()` rồi chuyển
`.wrap` của mình vào cột giữa, nên mọi thao tác kiểm duyệt không đổi.

---

## 2c. Đánh số phiên bản file tĩnh — CHẠY SAU MỖI LẦN SỬA JS/CSS

GitHub Pages trả `Cache-Control: max-age=600`. Trong 10 phút sau khi đẩy code,
trình duyệt người dùng vẫn dùng bản cũ. Nếu HTML mới gặp JS cũ thì trang **chết
câm**: đã xảy ra thật khi đổi `riotId` thành `vietId` — `app.js` mới import
`vietId`, `auth.js` cũ trong cache không có export đó, module ném lỗi lúc nạp,
trang treo mãi ở "Đang tải…" (mà widget chat vẫn chạy vì nó chỉ dùng export cũ).

Cách chặn: mọi đường dẫn tới JS/CSS đều mang `?v=<số>`. Sau khi sửa
`auth.js` / `app.js` / `chat.js` / `base.css` / `app.css`, tăng số rồi chạy:

```bash
node tools/phienban.js 6
```

**Bắt buộc đồng bộ tuyệt đối.** Trình duyệt coi `auth.js` và `auth.js?v=6` là
hai module KHÁC NHAU: nó sẽ nạp file hai lần, thành hai client Supabase, hai
websocket realtime, hai bộ nhớ đệm hồ sơ. Vì vậy script sửa cả:

- `<script type="module" src="assets/js/....js?v=6">` trong HTML
- `import ... from './assets/js/....js?v=6'` trong script nội tuyến của HTML
- `import ... from './auth.js?v=6'` **bên trong** `app.js` và `chat.js`

Đừng đánh số thủ công từng chỗ — sót một nơi là sinh lỗi nạp đôi, rất khó thấy.

Bốn trang cần đăng nhập còn có một cái chốt: sau 8 giây mà `#loading` vẫn hiện
thì đổi chữ thành "Không tải được trang. Bấm Ctrl+Shift+R để nạp lại." Lỗi nạp
module không bắt bằng try/catch được, nên đây là cách duy nhất để trang nói ra
thay vì treo im.

---

## 3. Dữ liệu

### `profiles` — hồ sơ công khai

Khóa chính trỏ thẳng tới `auth.users(id)`, `on delete cascade`.

| Cột | Ghi chú |
|---|---|
| `username` + `tag` | **Viet ID**, ví dụ `TuanViet#0417`. Cặp này là duy nhất |
| `display_name`, `avatar_url`, `bio` | Người dùng tự nhập, không bắt buộc |
| `role` | `user` / `moderator` / `admin` |
| `status` | `active` / `suspended` / `banned` |

**Vì sao dùng Viet ID thay vì tên duy nhất:** nhiều người trùng tên vẫn đăng ký
được, không phải tranh nhau tên đẹp. Thẻ số 4 chữ số sinh ngẫu nhiên, có vòng lặp
kiểm tra trùng.

**Cảnh báo:** `username` bị cắt còn **16 ký tự** từ phần trước `@` của email
(`left(base, 16)`). Email `thienpham12112003@gmail.com` cho ra `thienpham1211200`
— mất chữ số cuối. **Hiện chưa có cách đổi Viet ID.** Nếu muốn thêm, làm sớm
trước khi có nhiều người dùng.

### `friendships` — quan hệ hai chiều

**Quyết định thiết kế quan trọng nhất:** mỗi cặp người chỉ có **một hàng duy nhất**,
với ràng buộc `user_a < user_b` (luôn xếp id nhỏ hơn trước).

Vì sao: nếu cho phép hai hàng (A→B và B→A) thì sẽ có lúc chúng mâu thuẫn — A nghĩ
đã kết bạn, B nghĩ đã chặn. Một hàng thì không bao giờ mâu thuẫn được.

Hệ quả khi viết code: trước khi truy vấn phải sắp xếp id. Hàm `gui_loi_moi(ban_id)`
lo việc này giúp; phía JS có hàm `pairOf()` trong `ban-be.html`.

Trạng thái: `pending` → `accepted`, hoặc `blocked`. Cột `requested_by` ghi ai là
người bấm gửi / bấm chặn.

Trigger `guard_friendship_block` chặn ba trò gian:
- Người bị chặn tự gỡ chặn
- Đổi `requested_by` để giả làm người gửi
- Tự đồng ý lời mời do chính mình gửi

### `messages` — tin nhắn 1-1

| Quyết định | Vì sao |
|---|---|
| **Chỉ bạn bè `accepted` mới gửi được** | Tấm khiên chống quấy rối lớn nhất, và miễn phí vì đã có hệ thống kết bạn. Kiểm ở trigger, không ở JS |
| **Không có policy `DELETE`** | Không ai xoá cứng được, kể cả người gửi. "Thu hồi" chỉ set `deleted_at`. Xoá thật = mất bằng chứng khi xử lý báo cáo |
| **Không sửa được `body` đã gửi** | Tránh trò gửi nội dung xấu rồi sửa lại khi bị báo cáo. Trigger `guard_message_update` chỉ cho đổi `read_at` và `deleted_at` |
| **Giới hạn 20 tin / 10 giây** | Chống spam và bot |
| `admin` / `moderator` đọc được tất cả | Để xử lý báo cáo. Đây là đánh đổi có chủ ý: quyền riêng tư nhường cho khả năng kiểm duyệt |

Realtime bật bằng `alter publication supabase_realtime add table public.messages`.
RLS vẫn áp dụng cho realtime, nên mỗi người chỉ nhận được tin của chính mình.

#### Thông báo tin nhắn mới (trong `chat.js`)

Bốn lớp, xếp từ chắc chắn nhất tới cần xin phép:

| Lớp | Điều kiện | Ghi chú |
|---|---|---|
| Đếm trên **tiêu đề tab** `(2) Ashfall…` | Luôn chạy | Thấy được cả khi ở tab khác |
| **Thẻ nổi** góc phải, bấm mở thẳng cuộc trò chuyện | Luôn chạy | Tự tắt sau 7 giây, tối đa 3 thẻ |
| **Tiếng ding** (Web Audio, không cần file âm thanh) | Sau cú bấm chuột đầu tiên | Trình duyệt cấm phát tiếng trước khi người dùng tương tác. Tắt/bật bằng nút 🔊, nhớ trong `localStorage` |
| **Thông báo hệ điều hành** | Cần cấp quyền **và** tab đang ẩn | Xin quyền bằng nút 🔔 trong khung chat, **không** tự bật lúc tải trang (Chrome phạt hành vi đó) |

Không báo khi người dùng **đang mở đúng cuộc trò chuyện đó và tab đang hiện** —
biến `dangDocCuocNay`. Quay lại tab thì tự đánh dấu đã đọc (`visibilitychange`).

> **Giới hạn:** chỉ báo được khi **trang web đang mở** trong một tab nào đó.
> Muốn báo cả khi đã đóng trình duyệt thì cần Service Worker + Web Push API +
> máy chủ đẩy tin (VAPID) — việc lớn hơn nhiều, chưa làm.

### `reports` — báo cáo vi phạm

Lý do: `quay_roi` · `spam` · `lua_dao` · `noi_dung_xau` · `khac`.
Trạng thái: `moi` → `da_xem` → `da_xu_ly`.

Xử lý ở `quan-tri.html` — xem §4b.

---

## 4. Hàm database

| Hàm | Dùng làm gì |
|---|---|
| `gui_loi_moi(ban_id)` | Gửi lời mời, tự lo việc sắp xếp `user_a < user_b` |
| `tim_nguoi_choi(tu_khoa)` | Tìm theo Viet ID. Gõ `Ten` tìm gần đúng, `Ten#1234` tìm chính xác |
| `danh_sach_ban()` | Bạn bè + lời mời đến + lời mời đã gửi + đã chặn |
| `danh_sach_hoi_thoai()` | Danh sách chat kèm tin cuối và số tin chưa đọc |
| `danh_dau_da_doc(nguoi_gui)` | Đánh dấu đã đọc cả cuộc trò chuyện |

### 4b. Quản trị & kiểm duyệt (`admin.sql`)

| Hàm | Ai gọi được |
|---|---|
| `vai_tro_cua_toi()` | mọi người đã đăng nhập |
| `admin_ds_bao_cao(loc)` | admin, moderator |
| `admin_ds_nguoi_dung(tu_khoa)` | admin, moderator |
| `admin_doi_trang_thai(id, trang_thai, ly_do)` | admin, moderator |
| `admin_an_tin_nhan(id, ly_do)` | admin, moderator |
| `admin_xu_ly_bao_cao(id, trang_thai, ghi_chu)` | admin, moderator |
| `admin_nhat_ky()` | admin, moderator |
| `admin_doi_vai_tro(id, vai_tro)` | **chỉ admin** |

**Phân quyền:**

- `moderator` — đọc báo cáo, ẩn tin nhắn, **tạm khóa** tài khoản
- `admin` — tất cả những trên + **cấm vĩnh viễn** + **đổi vai trò**

**Ba luật cứng**, cài ở trigger `guard_profile_privileges` chứ không ở giao diện:

1. **Không ai tự đổi vai trò hoặc trạng thái của chính mình** — tránh tự khóa mình
   ra ngoài, và tránh người dùng thường tự phong admin
2. **Kiểm duyệt viên không thao tác được trên admin** — tránh nội chiến quyền lực
3. **Mọi hành động đều ghi vào `admin_actions`** — bảng này **chỉ đọc được**, không
   có policy insert/update/delete nên không ai sửa hay xoá nhật ký, kể cả admin


---

## 5. Vận hành

### Tự phong admin

```sql
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
```

Chạy trong SQL Editor. Trigger `guard_profile_privileges` có nhánh cho
`auth.uid() is null` nên lệnh này chạy được từ SQL Editor, nhưng **không** chạy
được từ trình duyệt — người dùng thường không tự phong admin được.

### Cấu hình Supabase đã đặt

- **Site URL** = `https://ashfall.io.vn` (mặc định là `localhost:3000`, gây lỗi
  `ERR_CONNECTION_REFUSED` khi bấm link xác nhận email)
- **Redirect URLs** = `https://ashfall.io.vn/**`
- Vẫn **bắt xác nhận email** khi đăng ký

### Còn nợ

- [ ] Tắt *"Automatically expose new tables"* trong **Settings → API**
      (Supabase khuyên tắt; bảng mới quên bật RLS là lộ ngay)
- [ ] Cho phép đổi Viet ID

---

## 6. Hai lỗ hổng đã tìm ra và vá

### 6.1 Postgres mặc định cho **mọi người** gọi **mọi hàm**

`GRANT EXECUTE ... TO PUBLIC` là mặc định của Postgres. Các hàm ở đây là
`SECURITY DEFINER` — chạy với quyền chủ sở hữu và **bỏ qua RLS**. Nghĩa là người
chưa đăng nhập vẫn gọi được và có thể moi dữ liệu.

Lúc đó chúng trả về rỗng, nhưng **chỉ nhờ may mắn**: `auth.uid()` là `NULL` nên
mọi phép so sánh đều sai. Đó không phải là bảo vệ.

Cách vá (trong `hardening.sql`), làm đủ **cả hai**:

```sql
revoke all on function public.ten_ham(...) from public, anon;
grant execute on function public.ten_ham(...) to authenticated;
```

```sql
if auth.uid() is null then
  raise exception 'Bạn cần đăng nhập' using errcode = '42501';
end if;
```

### 6.2 Hồ sơ cho phép người chưa đăng nhập đọc toàn bộ

Policy ban đầu là `for select using (true)` — không giới hạn vai trò, nên ai cũng
tải về được danh sách toàn bộ người chơi. Đã siết thành `to authenticated`.

> Nếu sau này muốn trang hồ sơ công khai cho khách xem (kiểu op.gg), phải mở lại
> policy này **một cách có chủ ý**, và chỉ mở những cột thật sự cần.

---

## 7. Bẫy đã dính — đừng lặp lại

### 7.1 `NOT NULL` trong SQL không phải là `TRUE`

Lỗi thật đã xảy ra, mất thời gian mới tìm ra. Trong `tim_nguoi_choi`:

```sql
-- SAI
and not (f.status = 'blocked' and f.requested_by <> auth.uid())
```

`f` đến từ `LEFT JOIN`. Khi hai người **chưa có quan hệ gì**, `f.status` là `NULL`:

```
NULL = 'blocked'  →  NULL
NULL and ...      →  NULL
not NULL          →  NULL      ← không phải TRUE!
```

Mệnh đề `WHERE` chỉ giữ hàng khi điều kiện là `TRUE`, nên **mọi người lạ đều bị
loại**. Hậu quả: tìm kiếm chỉ ra người đã có quan hệ sẵn — đúng ngược với mục đích.

```sql
-- ĐÚNG
and not coalesce(f.status = 'blocked' and f.requested_by <> auth.uid(), false)
```

> **Quy tắc:** mọi điều kiện phủ định trên cột đến từ `LEFT JOIN` đều phải bọc
> `coalesce(..., false)`.

Lỗi này không lộ ra khi thử nghiệm lúc database còn trống, vì kết quả rỗng trông
vẫn "bình thường". **Phải thử với dữ liệu thật.**

### 7.2 Ba trang có bộ màu riêng — đừng ép dùng token chung

`base.css` định nghĩa token dùng chung, nhưng ba trang này tự định nghĩa lại `:root`
sau đó và **phải giữ nguyên**:

- `map.html` — dùng `--accent` thay vì `--ember`, giá trị nền cũng khác
- `blog-post-4.html` — có hệ thống sáng/tối riêng
- `404.html` — `--line` khác giá trị

Thứ tự nạp bắt buộc: `base.css` **trước** khối `<style>` của trang, để trang ghi đè được.

### 7.3 `_config.yml` giấu file khỏi web

`docs/` và `supabase/` nằm trong repo nhưng **không được xuất bản** lên
ashfall.io.vn. Thêm thư mục mới chứa thứ không nên công khai thì nhớ khai vào đây.

---

### 7.4 `NULL not in (...)` — vẫn là bẫy NULL, lần thứ hai

**Đã mắc lại đúng lỗi §7.1 ở một hình dạng khác.** Trong các hàm quản trị:

```sql
-- SAI
if public.vai_tro_cua_toi() not in ('admin','moderator') then
  raise exception 'Không có quyền';
end if;
```

Khi người gọi **không có hàng trong `profiles`**, hàm trả `NULL`:

```
NULL not in ('admin','moderator')  ->  NULL   (không phải TRUE)
if NULL then ...                   ->  không chạy
```

Phần kiểm tra quyền bị bỏ qua hoàn toàn, hàm chạy tiếp như thường.

```sql
-- ĐÚNG
if coalesce(public.vai_tro_cua_toi(), '') not in ('admin','moderator') then
```

> **Quy tắc rút ra:** bất cứ khi nào so sánh một giá trị **có thể là NULL**, phải
> hoặc bọc `coalesce`, hoặc dùng `is distinct from`. `not in`, `<>`, `not (...)`
> đều trả `NULL` khi gặp `NULL`, và `if NULL` thì **không chạy**.

Các **policy** dùng `vai_tro_cua_toi() in (...)` thì *không* dính lỗi này, vì policy
chỉ cho qua khi điều kiện là `TRUE` — `NULL` bị coi như từ chối. Chỉ `if` trong
plpgsql mới nguy hiểm.

Lỗi này bị bắt nhờ bài test ở §8b, không phải nhờ đọc lại code.

### 7.5 Thuộc tính `hidden` bị CSS của chính widget vô hiệu hóa

`element.hidden = true` chỉ có tác dụng nhờ luật mặc định của trình duyệt
`[hidden]{ display:none }`. **Mọi luật `display` do mình viết đều thắng luật đó**,
bất kể độ cụ thể, vì stylesheet của tác giả luôn đứng trên stylesheet trình duyệt.

Trong `assets/js/chat.js` có:

```css
.ash-chat__panel{ display:flex; ... }   /* khung chat  */
.ash-chat__icon{  display:grid; ... }   /* nút ← ✕ 🔔 */
```

Hậu quả: `panel.hidden = true` (nút ✕, phím Esc, bấm ra ngoài) **không đóng được
khung chat**, và `back.hidden = true` không giấu được mũi tên quay lại. Người dùng
thấy khung chat mở thường trực với mũi tên ← thừa ở màn hình danh sách.

Cách vá — một dòng, đặt cuối khối CSS của widget:

```css
.ash-chat[hidden], .ash-chat [hidden]{ display:none !important; }
```

> **Quy tắc rút ra:** widget nào tự bơm CSS và dùng `.hidden` để bật/tắt thì phải
> kèm một luật `[hidden]{ display:none !important }` trong phạm vi của nó. Đây là
> một trong số rất ít chỗ `!important` là đúng.

### 7.6 `nav{}` trong base.css áp cho **mọi** thẻ `<nav>`

`assets/css/base.css` dựng thanh điều hướng của các trang con bằng selector trần:

```css
nav{ position:fixed; top:0; left:0; right:0; z-index:1000; ... }
```

Trang chủ có **hai** thẻ `<nav>` không liên quan (`.nav` ở góc trái, `.mnav` là dải
cuộn ngang cho điện thoại). Cả hai bị ghim lên đỉnh màn hình ở `z-index:1000`, đè
lên logo, ô tìm kiếm và nút **Đăng nhập** — trên điện thoại nút đăng nhập biến mất.

Đã thu hẹp thành `nav:not(.nav):not(.mnav){ ... }`. Nếu sau này thêm thẻ `<nav>`
mới ở trang chủ, nhớ thêm class đó vào danh sách loại trừ.

---
## 8. Cách kiểm thử bảo mật

Đừng tin là an toàn chỉ vì code trông đúng. **Tấn công thử bằng chính khóa công khai**:

```bash
K="<anon key>"; U="https://bvpuxsywjnlisbrzhboz.supabase.co"
q(){ curl -s "$@" -H "apikey: $K" -H "Authorization: Bearer $K"; }

q "$U/rest/v1/messages?select=body"                    # phải rỗng
q -X POST "$U/rest/v1/messages" -H "Content-Type: application/json" \
  -d '{"sender_id":"...","recipient_id":"...","body":"x"}'   # phải bị từ chối
q -X POST "$U/rest/v1/rpc/danh_sach_hoi_thoai" -d '{}'       # permission denied
```

Kiểm tra cấu hình trực tiếp trong database:

```sql
select
  (select relrowsecurity from pg_class where oid='public.messages'::regclass) as rls_bat,
  (select count(*) from pg_policies where tablename='messages' and cmd='DELETE') as policy_xoa,
  has_function_privilege('anon','public.danh_sach_hoi_thoai()','execute') as anon_goi_duoc;
```

Mong đợi: `rls_bat = true`, `policy_xoa = 0`, `anon_goi_duoc = false`.

> **Lưu ý khi đọc kết quả:** thao tác `DELETE` trả về HTTP 204 khi bảng trống
> **không** chứng minh được gì — chỉ là không có hàng nào khớp. Muốn chắc thì đếm
> policy như trên.

---

### 8b. Thử vượt quyền bằng cách đóng vai người khác

Cách mạnh nhất: giả lập JWT ngay trong SQL Editor rồi thử phá từng luật.
Bài test này đã bắt được lỗi §7.4.

```sql
create temp table ket_qua(stt int, phep_thu text, ket_luan text) on commit drop;

do $$
declare mod_id uuid := (select id from public.profiles where username='...');
        r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', mod_id)::text, true);
  begin update public.profiles set role='admin' where id=mod_id;
    r:='LỌT LƯỚI'; exception when others then r:='chặn'; end;
  insert into ket_qua values (1,'Tự phong admin', r);

  -- người KHÔNG có hồ sơ → vai trò NULL, đây là chỗ hay lọt
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  begin perform public.admin_ds_bao_cao('moi');
    r:='LỌT LƯỚI'; exception when others then r:='chặn'; end;
  insert into ket_qua values (2,'Không hồ sơ: xem báo cáo', r);

  perform set_config('request.jwt.claims', NULL, true);   -- BỎ ĐÓNG VAI trước khi dọn
end $$;

select * from ket_qua order by stt;
```

Ba lưu ý khi viết bài test kiểu này:

- `set_config(..., true)` chỉ sống trong **một giao dịch**; cả script là một giao
  dịch, nên phải `set_config(..., NULL, true)` **trước** khi dọn dẹp — nếu không,
  lệnh dọn sẽ bị chính luật vừa test chặn lại và toàn bộ giao dịch bị hủy
- Dùng bảng tạm để **trả kết quả ra bảng**; `raise notice` không hiện trong SQL Editor
- Supabase cảnh báo bảng tạm không có RLS — bảng tạm tự xóa khi kết thúc,
  bấm **Run without RLS** là đúng

---
## 9. Lộ trình

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| 1 | Đăng nhập, hồ sơ, chính sách bảo mật | ✅ 21/09/2026 |
| 2 | Kết bạn, tìm theo Viet ID | ✅ 21/09/2026 |
| 3 | Chat 1-1 realtime, thu hồi, báo cáo | ✅ 21/09/2026 |
| 4 | Trang admin: danh sách user, xử lý `reports`, cấm tài khoản | ✅ 21/09/2026 |
| 5 | Nối Godot: đăng nhập trong game, đồng bộ Nghiệp Ấn / boss đã hạ | ⬜ |

### Cảnh báo cho đợt 5

**Không tin dữ liệu game client gửi lên.** Người chơi sửa file game có thể gửi
"tôi hạ boss trong 3 giây". Với game nhỏ thì chấp nhận được, nhưng **đừng làm bảng
xếp hạng công khai từ dữ liệu này rồi tin nó là thật.** Nếu cần xếp hạng nghiêm
túc thì phải kiểm chứng ở phía máy chủ.

### Cảnh báo chung về chat

Đợt 3 **nặng về trách nhiệm, không nặng về kỹ thuật**. Mở chat giữa người lạ là
nhận một nghĩa vụ lâu dài: phải có người thật đọc báo cáo và xử lý. Thiết kế
"chỉ bạn bè mới nhắn được" đã giảm rủi ro rất nhiều, nhưng không xoá bỏ được nó.
Game soulslike có nhiều người chơi tuổi teen.
