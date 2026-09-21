-- =============================================================================
-- Ashfall — Trò chuyện 1-1 (Đợt 3)
-- Chạy trong Supabase Dashboard → SQL Editor → New query → Run.
-- Cần chạy schema.sql + friends.sql + hardening.sql trước.
-- =============================================================================

-- ------------------------------------------------------------ tin nhắn ----
create table if not exists public.messages (
  id           bigint generated always as identity primary key,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  deleted_at   timestamptz,                    -- xoá mềm: giữ bản ghi để xử lý báo cáo
  constraint messages_khong_tu_nhan check (sender_id <> recipient_id)
);

create index if not exists messages_cap_idx
  on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index if not exists messages_chua_doc_idx
  on public.messages (recipient_id, read_at) where read_at is null;

-- ------------------------------------------------------------ báo cáo ----
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  message_id  bigint references public.messages(id) on delete set null,
  reason      text not null check (reason in ('quay_roi','spam','lua_dao','noi_dung_xau','khac')),
  note        text check (length(note) <= 500),
  status      text not null default 'moi' check (status in ('moi','da_xem','da_xu_ly')),
  created_at  timestamptz not null default now(),
  constraint reports_khong_tu_bao_cao check (reporter_id <> reported_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- ------------------------- chỉ bạn bè mới gửi được + chống spam ----------
create or replace function public.guard_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gan_day int;
begin
  if auth.uid() is null then
    return new;                                       -- SQL Editor / service_role
  end if;

  -- phải là bạn bè đã đồng ý (đồng thời loại luôn trường hợp bị chặn)
  if not exists (
    select 1 from public.friendships f
     where f.user_a = least(new.sender_id, new.recipient_id)
       and f.user_b = greatest(new.sender_id, new.recipient_id)
       and f.status = 'accepted'
  ) then
    raise exception 'Chỉ nhắn tin được với bạn bè';
  end if;

  -- người nhận phải còn hoạt động
  if not exists (
    select 1 from public.profiles p
     where p.id = new.recipient_id and p.status = 'active'
  ) then
    raise exception 'Không gửi được cho tài khoản này';
  end if;

  -- chống spam: tối đa 20 tin trong 10 giây
  select count(*) into gan_day
    from public.messages m
   where m.sender_id = new.sender_id
     and m.created_at > now() - interval '10 seconds';
  if gan_day >= 20 then
    raise exception 'Bạn gửi quá nhanh, chờ một chút rồi thử lại';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_guard_insert on public.messages;
create trigger messages_guard_insert
  before insert on public.messages
  for each row execute function public.guard_message_insert();

-- ------------------------------------------------------ Row Level Security ----
alter table public.messages enable row level security;
alter table public.reports  enable row level security;

drop policy if exists messages_read_own    on public.messages;
drop policy if exists messages_send_own    on public.messages;
drop policy if exists messages_update_own  on public.messages;
drop policy if exists messages_admin_read  on public.messages;

-- chỉ đọc tin của chính mình (gửi hoặc nhận)
create policy messages_read_own
  on public.messages for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));

-- admin/kiểm duyệt viên đọc được để xử lý báo cáo
create policy messages_admin_read
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('admin','moderator')
  ));

-- chỉ tự gửi dưới tên mình (điều kiện bạn bè do trigger lo)
create policy messages_send_own
  on public.messages for insert to authenticated
  with check (auth.uid() = sender_id);

-- người nhận đánh dấu đã đọc; người gửi xoá mềm tin của mình
create policy messages_update_own
  on public.messages for update to authenticated
  using      (auth.uid() in (sender_id, recipient_id))
  with check (auth.uid() in (sender_id, recipient_id));

-- KHÔNG có policy DELETE: không ai xoá cứng được, kể cả chính mình.

drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_read_own   on public.reports;
drop policy if exists reports_admin_all  on public.reports;

create policy reports_insert_own
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy reports_read_own
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id);

create policy reports_admin_all
  on public.reports for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','moderator')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','moderator')));

-- ------------------------------ chặn sửa nội dung tin đã gửi ----------
-- Chỉ cho phép đổi read_at và deleted_at, không cho sửa chữ đã gửi.
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  -- chỉ người nhận mới đánh dấu đã đọc
  if new.read_at is distinct from old.read_at and auth.uid() <> old.recipient_id then
    raise exception 'Chỉ người nhận mới đánh dấu đã đọc';
  end if;

  -- chỉ người gửi mới thu hồi tin của mình
  if new.deleted_at is distinct from old.deleted_at and auth.uid() <> old.sender_id then
    raise exception 'Chỉ người gửi mới thu hồi được tin này';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- ------------------------------------- danh sách hội thoại (bạn bè) ----
create or replace function public.danh_sach_hoi_thoai()
returns table (
  id uuid, username text, tag text, display_name text, avatar_url text,
  tin_cuoi text, tin_cuoi_cua_toi boolean, thoi_gian timestamptz, chua_doc bigint
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
  with ban as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as ban_id
      from public.friendships f
     where f.status = 'accepted'
       and auth.uid() in (f.user_a, f.user_b)
  ),
  cuoi as (
    select distinct on (doi_phuong)
           case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as doi_phuong,
           m.body, m.created_at, (m.sender_id = auth.uid()) as cua_toi, m.deleted_at
      from public.messages m
     where auth.uid() in (m.sender_id, m.recipient_id)
     order by doi_phuong, m.created_at desc
  ),
  dem as (
    select m.sender_id as doi_phuong, count(*) as n
      from public.messages m
     where m.recipient_id = auth.uid() and m.read_at is null and m.deleted_at is null
     group by m.sender_id
  )
  select p.id, p.username, p.tag, p.display_name, p.avatar_url,
         case when c.deleted_at is not null then null else c.body end,
         c.cua_toi, c.created_at, coalesce(d.n, 0)
    from ban b
    join public.profiles p on p.id = b.ban_id
    left join cuoi c on c.doi_phuong = b.ban_id
    left join dem  d on d.doi_phuong = b.ban_id
   order by c.created_at desc nulls last, p.username;
end;
$$;

-- ------------------------------------------ đánh dấu đã đọc cả cuộc ----
create or replace function public.danh_dau_da_doc(nguoi_gui uuid)
returns void
language plpgsql
security invoker                      -- vẫn chịu RLS
set search_path = ''
as $$
begin
  update public.messages
     set read_at = now()
   where recipient_id = auth.uid()
     and sender_id = nguoi_gui
     and read_at is null;
end;
$$;

revoke all on function public.danh_sach_hoi_thoai()  from public, anon;
revoke all on function public.danh_dau_da_doc(uuid)  from public, anon;
grant execute on function public.danh_sach_hoi_thoai() to authenticated;
grant execute on function public.danh_dau_da_doc(uuid) to authenticated;

-- --------------------------------------------- bật cập nhật tức thời ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
