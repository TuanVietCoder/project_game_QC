-- =============================================================================
-- Ashfall — Sửa lỗi không tìm thấy người chơi mới
--
-- Lỗi: điều kiện lọc người đã chặn viết là
--        and not (f.status = 'blocked' and f.requested_by <> auth.uid())
--      Khi hai người CHƯA có quan hệ, phép nối trái cho f.status = NULL.
--      Trong SQL: NULL = 'blocked'  -> NULL
--                 NULL and ...      -> NULL
--                 not NULL          -> NULL   (không phải TRUE!)
--      Mệnh đề WHERE chỉ giữ hàng khi điều kiện là TRUE, nên mọi người lạ
--      đều bị loại → tìm kiếm luôn rỗng.
--
-- Sửa: bọc bằng coalesce(..., false) để khi chưa có quan hệ thì coi như
--      "không bị chặn" và vẫn hiện ra.
-- =============================================================================

create or replace function public.tim_nguoi_choi(tu_khoa text)
returns table (
  id uuid, username text, tag text, display_name text,
  avatar_url text, role text, trang_thai text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ten  text := lower(trim(split_part(tu_khoa, '#', 1)));
  the_ text := nullif(trim(split_part(tu_khoa, '#', 2)), '');
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
     -- khớp tên (bắt đầu bằng) hoặc tên hiển thị (chứa)
     and (
          lower(p.username) like ten || '%'
       or lower(coalesce(p.display_name, '')) like '%' || ten || '%'
     )
     -- nếu người dùng gõ cả #thẻ thì thẻ phải khớp chính xác
     and (the_ is null or p.tag = the_)
     -- SỬA: chưa có quan hệ (NULL) nghĩa là chưa bị chặn
     and not coalesce(f.status = 'blocked' and f.requested_by <> auth.uid(), false)
   order by (lower(p.username) = ten) desc, p.username
   limit 20;
end;
$$;

revoke all on function public.tim_nguoi_choi(text) from public, anon;
grant execute on function public.tim_nguoi_choi(text) to authenticated;
