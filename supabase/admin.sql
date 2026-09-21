-- =============================================================================
-- Ashfall — Quản trị & kiểm duyệt (Đợt 4)
-- Chạy SAU schema.sql, friends.sql, hardening.sql, fix-tim-kiem.sql, chat.sql
--
-- Phân quyền:
--   moderator : đọc báo cáo, ẩn tin nhắn, TẠM KHÓA tài khoản
--   admin     : tất cả những trên + CẤM vĩnh viễn + đổi vai trò
--
-- Ba luật cứng, cài ở database chứ không ở giao diện:
--   1. Không ai tự hạ quyền / tự khóa chính mình  → tránh tự khóa mình ra ngoài
--   2. Kiểm duyệt viên không đụng được admin      → tránh nội chiến quyền lực
--   3. Mọi hành động đều bị ghi log               → có trách nhiệm giải trình
-- =============================================================================

-- ------------------------------------------------- vai trò của người gọi ----
create or replace function public.vai_tro_cua_toi()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.vai_tro_cua_toi() from public, anon;
grant execute on function public.vai_tro_cua_toi() to authenticated;

-- ------------------------------------------------------- nhật ký hành động ----
create table if not exists public.admin_actions (
  id                bigint generated always as identity primary key,
  actor_id          uuid not null references public.profiles(id) on delete set null,
  action            text not null check (action in
                      ('an_tin_nhan','tam_khoa','cam','go_khoa','doi_vai_tro','xu_ly_bao_cao')),
  target_user_id    uuid    references public.profiles(id) on delete set null,
  target_message_id bigint  references public.messages(id) on delete set null,
  report_id         bigint  references public.reports(id)  on delete set null,
  chi_tiet          text,
  created_at        timestamptz not null default now()
);

create index if not exists admin_actions_time_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

drop policy if exists admin_actions_read on public.admin_actions;
-- chỉ đội ngũ đọc được; KHÔNG có policy insert/update/delete → chỉ ghi được
-- qua các hàm bên dưới, không ai sửa hay xoá được nhật ký
create policy admin_actions_read
  on public.admin_actions for select to authenticated
  using (public.vai_tro_cua_toi() in ('admin','moderator'));

-- --------------------- cho kiểm duyệt viên khóa được tài khoản ----
-- Trigger cũ chỉ cho admin đổi role/status. Nay tách ra: status thì
-- moderator cũng được, role thì vẫn chỉ admin.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vai_tro_goi text;
begin
  if new.role is not distinct from old.role
     and new.status is not distinct from old.status then
    return new;                                   -- không đụng tới quyền
  end if;

  if auth.uid() is null then
    return new;                                   -- SQL Editor / service_role
  end if;

  select p.role into vai_tro_goi from public.profiles p where p.id = auth.uid();

  -- LUẬT 1: không tự đổi quyền hoặc trạng thái của chính mình
  if auth.uid() = old.id then
    raise exception 'Không thể tự đổi vai trò hoặc trạng thái của chính mình';
  end if;

  -- đổi vai trò: chỉ admin
  if new.role is distinct from old.role and vai_tro_goi is distinct from 'admin' then
    raise exception 'Chỉ quản trị viên mới đổi được vai trò';
  end if;

  -- đổi trạng thái: admin hoặc kiểm duyệt viên
  if new.status is distinct from old.status
     and vai_tro_goi not in ('admin','moderator') then
    raise exception 'Không có quyền khóa hoặc mở khóa tài khoản';
  end if;

  -- LUẬT 2: kiểm duyệt viên không đụng được admin, và không cấm vĩnh viễn
  if vai_tro_goi = 'moderator' then
    if old.role = 'admin' then
      raise exception 'Kiểm duyệt viên không thao tác được trên quản trị viên';
    end if;
    if new.status = 'banned' then
      raise exception 'Chỉ quản trị viên mới cấm vĩnh viễn được';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- đội ngũ sửa được hồ sơ người khác (thay policy cũ chỉ cho admin)
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_team  on public.profiles;
create policy profiles_update_team
  on public.profiles for update to authenticated
  using      (public.vai_tro_cua_toi() in ('admin','moderator'))
  with check (public.vai_tro_cua_toi() in ('admin','moderator'));

-- ------------------------------ cho đội ngũ ẩn được tin nhắn vi phạm ----
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vai_tro_goi text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Không sửa được nội dung tin nhắn đã gửi';
  end if;

  select p.role into vai_tro_goi from public.profiles p where p.id = auth.uid();

  if new.read_at is distinct from old.read_at and auth.uid() <> old.recipient_id then
    raise exception 'Chỉ người nhận mới đánh dấu đã đọc';
  end if;

  -- người gửi tự thu hồi, HOẶC đội ngũ ẩn tin vi phạm
  if new.deleted_at is distinct from old.deleted_at
     and auth.uid() <> old.sender_id
     and coalesce(vai_tro_goi, 'user') not in ('admin','moderator') then
    raise exception 'Không có quyền ẩn tin nhắn này';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

drop policy if exists messages_update_own  on public.messages;
drop policy if exists messages_update_team on public.messages;
create policy messages_update_own
  on public.messages for update to authenticated
  using      (auth.uid() in (sender_id, recipient_id))
  with check  (auth.uid() in (sender_id, recipient_id));
create policy messages_update_team
  on public.messages for update to authenticated
  using      (public.vai_tro_cua_toi() in ('admin','moderator'))
  with check (public.vai_tro_cua_toi() in ('admin','moderator'));

-- ============================================================ hàm quản trị ===

-- ------------------------------------------------ danh sách báo cáo ----
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
  if public.vai_tro_cua_toi() not in ('admin','moderator') then
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

-- ------------------------------------------------ danh sách người dùng ----
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
  if public.vai_tro_cua_toi() not in ('admin','moderator') then
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

-- ---------------------------------------------- đổi trạng thái tài khoản ----
create or replace function public.admin_doi_trang_thai(
  nguoi_dung uuid, trang_thai text, ly_do text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  vai_tro_goi text := public.vai_tro_cua_toi();
begin
  if vai_tro_goi not in ('admin','moderator') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  if trang_thai not in ('active','suspended','banned') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  -- các luật cứng do trigger guard_profile_privileges kiểm lại lần nữa
  update public.profiles set status = trang_thai where id = nguoi_dung;

  insert into public.admin_actions (actor_id, action, target_user_id, chi_tiet)
  values (auth.uid(),
          case trang_thai when 'suspended' then 'tam_khoa'
                          when 'banned'    then 'cam'
                          else 'go_khoa' end,
          nguoi_dung, ly_do);
end;
$$;

-- ------------------------------------------------------- đổi vai trò ----
create or replace function public.admin_doi_vai_tro(nguoi_dung uuid, vai_tro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.vai_tro_cua_toi() is distinct from 'admin' then
    raise exception 'Chỉ quản trị viên mới đổi được vai trò' using errcode = '42501';
  end if;
  if vai_tro not in ('user','moderator','admin') then
    raise exception 'Vai trò không hợp lệ';
  end if;

  update public.profiles set role = vai_tro where id = nguoi_dung;

  insert into public.admin_actions (actor_id, action, target_user_id, chi_tiet)
  values (auth.uid(), 'doi_vai_tro', nguoi_dung, 'đổi thành ' || vai_tro);
end;
$$;

-- --------------------------------------------------------- ẩn tin nhắn ----
create or replace function public.admin_an_tin_nhan(tin_id bigint, ly_do text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nguoi_gui uuid;
begin
  if public.vai_tro_cua_toi() not in ('admin','moderator') then
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

-- ---------------------------------------------------- xử lý báo cáo ----
create or replace function public.admin_xu_ly_bao_cao(
  bao_cao_id bigint, trang_thai text, ghi_chu text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.vai_tro_cua_toi() not in ('admin','moderator') then
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

-- ------------------------------------------------------- nhật ký gần đây ----
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
  if public.vai_tro_cua_toi() not in ('admin','moderator') then
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

-- ------------------------------------------------------------- quyền gọi ----
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
    'public.admin_nhat_ky()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
