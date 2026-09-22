-- =============================================================================
-- Ashfall — chỗ chứa ảnh đại diện
-- Chạy MỘT LẦN trong Supabase SQL Editor, sau admin.sql.
--
-- Nguyên tắc số một vẫn giữ: giới hạn nằm ở máy chủ, không nằm ở JavaScript.
-- Khoá anon là công khai, ai cũng gọi thẳng Storage API được, nên kích thước
-- và loại file phải do bucket chặn chứ không phải do trình duyệt chặn.
-- =============================================================================

-- ----------------------------------------------------------- 1. bucket ----
-- public = true: ai cũng xem được ảnh (cần thế, vì <img> tải không kèm token).
-- 2 MB, và chỉ nhận đúng bốn loại ảnh.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------ 2. quyền ----
-- Mỗi người chỉ được đụng vào thư mục mang chính id của mình: avatars/<uid>/…
-- storage.foldername('abc-123/avatar') trả về mảng {'abc-123'}, lấy phần tử đầu.

drop policy if exists avatar_ai_cung_xem_duoc on storage.objects;
create policy avatar_ai_cung_xem_duoc
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists avatar_tu_tai_len on storage.objects;
create policy avatar_tu_tai_len
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatar_tu_ghi_de on storage.objects;
create policy avatar_tu_ghi_de
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatar_tu_xoa on storage.objects;
create policy avatar_tu_xoa
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------ 3. kiểm ----
-- Chạy xong nên thấy đúng 4 dòng.
select policyname, cmd
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'avatar%'
 order by policyname;
