-- =============================================================================
-- Ashfall — Vá lỗi kiểm tra quyền trong các hàm quản trị
--
-- LỖI: các hàm viết
--        if public.vai_tro_cua_toi() not in ('admin','moderator') then ... end if;
--      Khi người gọi KHÔNG có hàng trong `profiles`, hàm trả về NULL:
--        NULL not in ('admin','moderator')  ->  NULL   (không phải TRUE)
--        if NULL then ...                   ->  không chạy
--      Kết quả: phần kiểm tra quyền bị bỏ qua, hàm chạy tiếp như thường.
--
--      Đây ĐÚNG LÀ lỗi đã gặp ở fix-tim-kiem.sql, chỉ khác hình dạng.
--      Xem docs/HE-THONG-TAI-KHOAN.md §7.1.
--
-- SỬA: bọc coalesce(..., '') để NULL thành chuỗi rỗng — so sánh ra TRUE và chặn.
--
-- Ghi chú: các POLICY dùng `vai_tro_cua_toi() in (...)` thì KHÔNG dính lỗi này,
-- vì policy chỉ cho qua khi điều kiện là TRUE; NULL bị coi như từ chối.
-- =============================================================================

create or replace function public.admin_ds_bao_cao(loc text default 'moi')
returns table (
  id bigint, reason text, note text, status text, created_at timestamptz,
  nguoi_bao_cao text, nguoi_bi_bao_cao text, bi_bao_cao_id uuid,
  vai_tro_bi_bao_cao text, trang_thai_bi_bao_cao text,
  message_id bigint, noi_dung text, da_an boolean, gui_luc timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.vai_tro_cua_toi(), '') not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;

  return query
  select r.id, r.reason, r.note, r.status, r.created_at,
         rp.username || '#' || rp.tag,
         tp.username || '#' || tp.tag,
         tp.id, tp.role, tp.status,
         m.id, m.body, (m.deleted_at is not null), m.created_at
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    join public.profiles tp on tp.id = r.reported_id
    left join public.messages m on m.id = r.message_id
   where loc = 'tat_ca' or r.status = loc
   order by (r.status = 'moi') desc, r.created_at desc
   limit 200;
end;
$$;

create or replace function public.admin_ds_nguoi_dung(tu_khoa text default '')
returns table (
  id uuid, username text, tag text, display_name text, avatar_url text,
  role text, status text, created_at timestamptz,
  so_bao_cao bigint, so_tin_nhan bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.vai_tro_cua_toi(), '') not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;

  return query
  select p.id, p.username, p.tag, p.display_name, p.avatar_url,
         p.role, p.status, p.created_at,
         (select count(*) from public.reports  r where r.reported_id = p.id),
         (select count(*) from public.messages m where m.sender_id   = p.id)
    from public.profiles p
   where coalesce(trim(tu_khoa), '') = ''
      or lower(p.username) like '%' || lower(trim(tu_khoa)) || '%'
      or lower(coalesce(p.display_name,'')) like '%' || lower(trim(tu_khoa)) || '%'
   order by p.created_at desc
   limit 100;
end;
$$;

create or replace function public.admin_doi_trang_thai(
  nguoi_dung uuid, trang_thai text, ly_do text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  vai_tro_goi text := coalesce(public.vai_tro_cua_toi(), '');
begin
  if vai_tro_goi not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  if trang_thai not in ('active','suspended','banned') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  update public.profiles set status = trang_thai where id = nguoi_dung;

  insert into public.admin_actions (actor_id, action, target_user_id, chi_tiet)
  values (auth.uid(),
          case trang_thai when 'suspended' then 'tam_khoa'
                          when 'banned'    then 'cam'
                          else 'go_khoa' end,
          nguoi_dung, ly_do);
end;
$$;

create or replace function public.admin_an_tin_nhan(tin_id bigint, ly_do text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nguoi_gui uuid;
begin
  if coalesce(public.vai_tro_cua_toi(), '') not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;

  update public.messages set deleted_at = now()
   where id = tin_id and deleted_at is null
   returning sender_id into nguoi_gui;

  if nguoi_gui is null then
    raise exception 'Tin nhắn không tồn tại hoặc đã bị ẩn';
  end if;

  insert into public.admin_actions (actor_id, action, target_user_id, target_message_id, chi_tiet)
  values (auth.uid(), 'an_tin_nhan', nguoi_gui, tin_id, ly_do);
end;
$$;

create or replace function public.admin_xu_ly_bao_cao(
  bao_cao_id bigint, trang_thai text, ghi_chu text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.vai_tro_cua_toi(), '') not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  if trang_thai not in ('moi','da_xem','da_xu_ly') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  update public.reports set status = trang_thai where id = bao_cao_id;

  insert into public.admin_actions (actor_id, action, report_id, chi_tiet)
  values (auth.uid(), 'xu_ly_bao_cao', bao_cao_id, trang_thai || coalesce(' — ' || ghi_chu, ''));
end;
$$;

create or replace function public.admin_nhat_ky()
returns table (
  id bigint, action text, chi_tiet text, created_at timestamptz,
  nguoi_lam text, doi_tuong text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.vai_tro_cua_toi(), '') not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;

  return query
  select a.id, a.action, a.chi_tiet, a.created_at,
         coalesce(ap.username || '#' || ap.tag, '(đã xoá)'),
         tp.username || '#' || tp.tag
    from public.admin_actions a
    left join public.profiles ap on ap.id = a.actor_id
    left join public.profiles tp on tp.id = a.target_user_id
   order by a.created_at desc
   limit 100;
end;
$$;

-- và siết quyền gọi lại (create or replace trả EXECUTE về mặc định PUBLIC)
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_ds_bao_cao(text)',
    'public.admin_ds_nguoi_dung(text)',
    'public.admin_doi_trang_thai(uuid,text,text)',
    'public.admin_doi_vai_tro(uuid,text)',
    'public.admin_an_tin_nhan(bigint,text)',
    'public.admin_xu_ly_bao_cao(bigint,text,text)',
    'public.admin_nhat_ky()',
    'public.vai_tro_cua_toi()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
