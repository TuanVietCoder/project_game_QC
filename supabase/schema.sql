-- =============================================================================
-- Ashfall — Lược đồ tài khoản (Đợt 1)
-- Chạy trong Supabase Dashboard → SQL Editor → New query → Run.
-- Chạy lại nhiều lần được, không làm hỏng dữ liệu đã có.
-- =============================================================================

-- ---------------------------------------------------------------- hồ sơ ----
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  tag          text not null check (tag ~ '^[0-9]{4}$'),
  display_name text check (char_length(display_name) <= 32),
  avatar_url   text check (avatar_url is null or avatar_url ~* '^https://'),
  bio          text check (char_length(bio) <= 300),
  role         text not null default 'user'   check (role   in ('user','moderator','admin')),
  status       text not null default 'active' check (status in ('active','suspended','banned')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (username, tag)
);

comment on table  public.profiles is 'Hồ sơ công khai. Viet ID = username#tag, ví dụ TuanViet#0417';
comment on column public.profiles.role is 'user | moderator | admin — chỉ admin đổi được (xem trigger guard_profile_privileges)';

create index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- --------------------------------------------------- tự cập nhật updated_at ----
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------- chặn tự nâng quyền (rất quan trọng) ----
-- Không có trigger này thì bất kỳ ai cũng tự đặt role = 'admin' cho chính mình.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if new.role is not distinct from old.role
     and new.status is not distinct from old.status then
    return new;                      -- không đụng tới quyền, cho qua
  end if;

  -- auth.uid() rỗng = đang chạy từ SQL Editor / service_role (quyền quản trị),
  -- không phải từ trình duyệt. Cho qua để còn tự phong admin lần đầu.
  if auth.uid() is null then
    return new;
  end if;

  select p.role into caller_role
    from public.profiles p
   where p.id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'Không có quyền thay đổi vai trò hoặc trạng thái tài khoản';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- -------------------------------- tạo hồ sơ tự động khi có người đăng ký ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base    text;
  new_tag text;
  tries   int := 0;
begin
  -- lấy phần trước @ của email, bỏ ký tự lạ
  base := regexp_replace(split_part(new.email, '@', 1), '[^A-Za-z0-9_]', '', 'g');
  if base is null or char_length(base) < 3 then
    base := 'player';
  end if;
  base := left(base, 16);

  loop
    new_tag := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles p where p.username = base and p.tag = new_tag
    );
    tries := tries + 1;
    if tries > 50 then
      base := left('player' || substr(new.id::text, 1, 6), 16);
      tries := 0;
    end if;
  end loop;

  insert into public.profiles (id, username, tag, display_name)
  values (new.id, base, new_tag, base)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------- Row Level Security ----
-- Khóa dán trong web là khóa công khai, nên MỌI lớp bảo vệ nằm ở đây.
alter table public.profiles enable row level security;

drop policy if exists profiles_read_all    on public.profiles;
drop policy if exists profiles_update_own  on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

-- ai cũng xem được hồ sơ (cần cho tìm bạn ở đợt 2)
create policy profiles_read_all
  on public.profiles for select
  using (true);

-- chỉ chủ tài khoản sửa hồ sơ của mình
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- admin sửa được hồ sơ người khác (để cấm tài khoản ở đợt 4)
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Không có policy INSERT/DELETE: hồ sơ chỉ sinh ra bởi trigger đăng ký,
-- và biến mất khi tài khoản auth bị xóa (on delete cascade).

-- ---------------------------------------------------------------- xong ----
-- Tự phong mình làm admin (thay email bằng email bạn đã đăng ký):
--   update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'wannacry74123@gmail.com');
-- Câu trên chạy trong SQL Editor với quyền quản trị nên trigger guard không chặn.
