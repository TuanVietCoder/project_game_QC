# Hệ thống tài khoản Ashfall — tài liệu kiến trúc

> **Đọc file này trước khi sửa bất cứ thứ gì liên quan tới đăng nhập, bạn bè hoặc
> tin nhắn.** Tài liệu ghi lại *vì sao* mọi thứ được làm như vậy, không chỉ *cái gì*
> đã được làm — phần "vì sao" mới là thứ dễ mất và tốn tiền nhất khi làm lại.
>
> Cập nhật lần cuối: 21/09/2026 · Trạng thái: xong đợt 1–3

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
| `assets/js/auth.js` | Client Supabase, `getProfile()`, gắn trạng thái đăng nhập vào nav |
| `assets/js/chat.js` | Widget chat nổi, tự gắn vào mọi trang |
| `assets/css/base.css` | Token màu + reset + nav dùng chung |
| `dang-nhap.html` | Đăng ký / đăng nhập |
| `ho-so.html` | Hồ sơ cá nhân, sửa tên hiển thị / ảnh / giới thiệu |
| `ban-be.html` | Tìm người, gửi/nhận lời mời, chặn |
| `chinh-sach-bao-mat.html` | Bắt buộc theo Nghị định 13/2023/NĐ-CP |

**Thứ tự chạy SQL** (khi dựng lại từ đầu):

```
schema.sql → friends.sql → hardening.sql → fix-tim-kiem.sql → chat.sql
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

## 3. Dữ liệu

### `profiles` — hồ sơ công khai

Khóa chính trỏ thẳng tới `auth.users(id)`, `on delete cascade`.

| Cột | Ghi chú |
|---|---|
| `username` + `tag` | **Riot ID**, ví dụ `TuanViet#0417`. Cặp này là duy nhất |
| `display_name`, `avatar_url`, `bio` | Người dùng tự nhập, không bắt buộc |
| `role` | `user` / `moderator` / `admin` |
| `status` | `active` / `suspended` / `banned` |

**Vì sao dùng Riot ID thay vì tên duy nhất:** nhiều người trùng tên vẫn đăng ký
được, không phải tranh nhau tên đẹp. Thẻ số 4 chữ số sinh ngẫu nhiên, có vòng lặp
kiểm tra trùng.

**Cảnh báo:** `username` bị cắt còn **16 ký tự** từ phần trước `@` của email
(`left(base, 16)`). Email `thienpham12112003@gmail.com` cho ra `thienpham1211200`
— mất chữ số cuối. **Hiện chưa có cách đổi Riot ID.** Nếu muốn thêm, làm sớm
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

### `reports` — báo cáo vi phạm

Lý do: `quay_roi` · `spam` · `lua_dao` · `noi_dung_xau` · `khac`.
Trạng thái: `moi` → `da_xem` → `da_xu_ly`.

> **Nợ kỹ thuật đang mở:** người dùng gửi báo cáo được rồi nhưng **chưa có trang nào
> để đọc và xử lý**. Đây là việc của đợt 4 và không còn là tùy chọn — đã có người
> gửi báo cáo thì phải có người đọc.

---

## 4. Hàm database

| Hàm | Dùng làm gì |
|---|---|
| `gui_loi_moi(ban_id)` | Gửi lời mời, tự lo việc sắp xếp `user_a < user_b` |
| `tim_nguoi_choi(tu_khoa)` | Tìm theo Riot ID. Gõ `Ten` tìm gần đúng, `Ten#1234` tìm chính xác |
| `danh_sach_ban()` | Bạn bè + lời mời đến + lời mời đã gửi + đã chặn |
| `danh_sach_hoi_thoai()` | Danh sách chat kèm tin cuối và số tin chưa đọc |
| `danh_dau_da_doc(nguoi_gui)` | Đánh dấu đã đọc cả cuộc trò chuyện |

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
- [ ] Trang admin để xử lý `reports`
- [ ] Cho phép đổi Riot ID

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

## 9. Lộ trình

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| 1 | Đăng nhập, hồ sơ, chính sách bảo mật | ✅ 21/09/2026 |
| 2 | Kết bạn, tìm theo Riot ID | ✅ 21/09/2026 |
| 3 | Chat 1-1 realtime, thu hồi, báo cáo | ✅ 21/09/2026 |
| 4 | Trang admin: danh sách user, xử lý `reports`, cấm tài khoản | ⬜ |
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
