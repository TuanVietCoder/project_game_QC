-- =============================================================================
-- Ashfall — Kết bạn (Đợt 2)
-- Chạy trong Supabase Dashboard → SQL Editor → New query → Run.
-- Chạy lại nhiều lần được.
-- =============================================================================

-- --------------------------------------------------------- bảng quan hệ ----
-- Mỗi cặp người chỉ có MỘT hàng. Để không bị hai hàng trùng (A→B và B→A),
-- ta luôn lưu id nhỏ hơn vào user_a. Cặp (user_a,user_b) là khoá chính.
create table if not exists public.friendships (
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  -- ai bấm gửi lời mời / ai bấm chặn
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_khac_nhau check (user_a <> user_b),
  constraint friendships_dung_thu_tu check (user_a < user_b)
);

comment on table public.friendships is
  'Quan hệ hai chiều. user_a luôn là id nhỏ hơn để mỗi cặp chỉ có một hàng.';

create index if not exists friendships_user_b_idx on public.friendships (user_b);
create index if not exists friendships_status_idx on public.friendships (status);

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at
  before update on public.friendships
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------ Row Level Security ----
alter table public.friendships enable row level security;

drop policy if exists friendships_read_own   on public.friendships;
drop policy if exists friendships_insert_own on public.friendships;
drop policy if exists friendships_update_own on public.friendships;
drop policy if exists friendships_delete_own on public.friendships;

-- chỉ thấy quan hệ mà mình là một bên
create policy friendships_read_own
  on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));

-- chỉ tự gửi lời mời cho mình, và phải là một bên của quan hệ
create policy friendships_insert_own
  on public.friendships for insert to authenticated
  with check (auth.uid() = requested_by and auth.uid() in (user_a, user_b));

-- hai bên đều sửa được (đồng ý / chặn)
create policy friendships_update_own
  on public.friendships for update to authenticated
  using      (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

-- hai bên đều xoá được (từ chối / huỷ kết bạn)
create policy friendships_delete_own
  on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

-- ---------------------------------------------- chặn người bị chặn quấy rối ----
-- Không cho bên bị chặn tự đổi trạng thái 'blocked' thành thứ khác.
create or replace function public.guard_friendship_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;                                   -- SQL Editor / service_role
  end if;

  -- đang bị chặn: chỉ người đã chặn mới gỡ được
  if old.status = 'blocked' and auth.uid() <> old.requested_by then
    raise exception 'Bạn không thể thay đổi quan hệ này';
  end if;

  -- người nhận lời mời không được tự nhận là người gửi
  if new.requested_by is distinct from old.requested_by
     and new.status <> 'blocked' then
    raise exception 'Không được đổi người gửi lời mời';
  end if;

  -- không tự đồng ý lời mời do chính mình gửi
  if old.status = 'pending' and new.status = 'accepted'
     and auth.uid() = old.requested_by then
    raise exception 'Phải đợi người kia đồng ý';
  end if;

  return new;
end;
$$;

drop trigger if exists friendships_guard_block on public.friendships;
create trigger friendships_guard_block
  before update on public.friendships
  for each row execute function public.guard_friendship_block();

-- -------------------------------------- hàm gửi lời mời (lo phần sắp xếp) ----
-- Gọi từ web: supabase.rpc('gui_loi_moi', { ban_id: '<uuid>' })
create or replace function public.gui_loi_moi(ban_id uuid)
returns public.friendships
language plpgsql
security invoker            -- vẫn chịu RLS, chỉ tiện cho việc sắp xếp id
set search_path = ''
as $$
declare
  toi uuid := auth.uid();
  a uuid; b uuid;
  kq public.friendships;
begin
  if toi is null then
    raise exception 'Bạn cần đăng nhập';
  end if;
  if ban_id = toi then
    raise exception 'Không thể tự kết bạn với chính mình';
  end if;
  if not exists (select 1 from public.profiles p where p.id = ban_id) then
    raise exception 'Không tìm thấy người này';
  end if;

  a := least(toi, ban_id);
  b := greatest(toi, ban_id);

  insert into public.friendships (user_a, user_b, requested_by, status)
  values (a, b, toi, 'pending')
  on conflict (user_a, user_b) do nothing
  returning * into kq;

  if kq is null then
    select * into kq from public.friendships f where f.user_a = a and f.user_b = b;
  end if;
  return kq;
end;
$$;

-- --------------------------------------------- tìm người theo Riot ID ----
-- Trả về tối đa 20 người, bỏ chính mình và người đã chặn mình.
create or replace function public.tim_nguoi_choi(tu_khoa text)
returns table (
  id uuid, username text, tag text, display_name text,
  avatar_url text, role text, trang_thai text
)
language sql
security definer
set search_path = ''
as $$
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
     -- người đã chặn mình thì không hiện ra
     and not (f.status = 'blocked' and f.requested_by <> auth.uid())
   order by (lower(p.username) = lower(split_part(tu_khoa, '#', 1))) desc, p.username
   limit 20;
$$;

-- ------------------------------------------- danh sách bạn & lời mời ----
create or replace function public.danh_sach_ban()
returns table (
  id uuid, username text, tag text, display_name text, avatar_url text,
  status text, toi_gui boolean, tu_khi timestamptz
)
language sql
security definer
set search_path = ''
as $$
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
$$;

grant execute on function public.gui_loi_moi(uuid)    to authenticated;
grant execute on function public.tim_nguoi_choi(text) to authenticated;
grant execute on function public.danh_sach_ban()      to authenticated;
