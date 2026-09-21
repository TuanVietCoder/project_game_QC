-- =============================================================================
-- Ashfall — Siết quyền (chạy SAU schema.sql và friends.sql)
--
-- Vá hai chỗ hở:
--   1. Postgres mặc định GRANT EXECUTE ... TO PUBLIC cho mọi hàm, nên người
--      chưa đăng nhập vẫn gọi được. Các hàm này là SECURITY DEFINER (chạy với
--      quyền chủ sở hữu, bỏ qua RLS) nên phải khoá lại cho chắc.
--   2. Hồ sơ đang cho cả người chưa đăng nhập đọc → ai cũng tải về được toàn bộ
--      danh sách người chơi. Siết lại: phải đăng nhập mới xem được hồ sơ người khác.
-- =============================================================================

-- ------------------------------------ 1. chỉ người đã đăng nhập gọi hàm ----
revoke all on function public.gui_loi_moi(uuid)    from public, anon;
revoke all on function public.tim_nguoi_choi(text) from public, anon;
revoke all on function public.danh_sach_ban()      from public, anon;

grant execute on function public.gui_loi_moi(uuid)    to authenticated;
grant execute on function public.tim_nguoi_choi(text) to authenticated;
grant execute on function public.danh_sach_ban()      to authenticated;

-- ---------------- 2. thêm chốt chặn ngay trong hàm, không dựa vào may rủi ----
-- Trước đây hàm trả rỗng khi chưa đăng nhập chỉ vì `p.id <> null` luôn sai.
-- Giờ báo lỗi rõ ràng thay vì im lặng trả rỗng.
create or replace function public.tim_nguoi_choi(tu_khoa text)
returns table (
  id uuid, username text, tag text, display_name text,
  avatar_url text, role text, trang_thai text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập' using errcode = '42501';
  end if;
  if tu_khoa is null or length(trim(tu_khoa)) < 2 then
    raise exception 'Nhập ít nhất 2 ký tự để tìm';
  end if;

  return query
  select p.id, p.username, p.tag, p.display_name, p.avatar_url, p.role,
         coalesce(
           case
             when f.status = 'accepted' then 'ban_be'
             when f.status = 'pending' and f.requested_by = auth.uid() then 'da_gui'
             when f.status = 'pending' then 'cho_minh_duyet'
             when f.status = 'blocked' then 'chan'
           end, 'chua') as trang_thai
    from public.profiles p
    left join public.friendships f
      on f.user_a = least(p.id, auth.uid())
     and f.user_b = greatest(p.id, auth.uid())
   where p.id <> auth.uid()
     and p.status = 'active'
     and (
       lower(p.username) like lower(split_part(tu_khoa, '#', 1)) || '%'
       or lower(coalesce(p.display_name, '')) like '%' || lower(tu_khoa) || '%'
     )
     and (tu_khoa not like '%#%' or p.tag = split_part(tu_khoa, '#', 2))
     and not (f.status = 'blocked' and f.requested_by <> auth.uid())
   order by (lower(p.username) = lower(split_part(tu_khoa, '#', 1))) desc, p.username
   limit 20;
end;
$$;

create or replace function public.danh_sach_ban()
returns table (
  id uuid, username text, tag text, display_name text, avatar_url text,
  status text, toi_gui boolean, tu_khi timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập' using errcode = '42501';
  end if;

  return query
  select p.id, p.username, p.tag, p.display_name, p.avatar_url,
         f.status,
         (f.requested_by = auth.uid()) as toi_gui,
         f.updated_at as tu_khi
    from public.friendships f
    join public.profiles p
      on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
   where auth.uid() in (f.user_a, f.user_b)
     and (f.status <> 'blocked' or f.requested_by = auth.uid())
   order by f.updated_at desc;
end;
$$;

revoke all on function public.tim_nguoi_choi(text) from public, anon;
revoke all on function public.danh_sach_ban()      from public, anon;
grant execute on function public.tim_nguoi_choi(text) to authenticated;
grant execute on function public.danh_sach_ban()      to authenticated;

-- ------------------- 3. phải đăng nhập mới xem được hồ sơ người khác ----
-- Nếu sau này muốn trang hồ sơ công khai cho khách xem, đổi lại policy này.
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_auth
  on public.profiles for select
  to authenticated
  using (true);
