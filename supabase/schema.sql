-- ============================================================
--  과학 학습 앱 — Supabase 데이터베이스 설계
--
--  사용법: Supabase 대시보드 → SQL Editor → 아래 내용 전체 붙여넣고 Run
--  한 번만 실행하면 돼요. 여러 번 실행해도 안전하게 만들어 뒀어요.
-- ============================================================


-- ------------------------------------------------------------
-- 1. 고유 코드 생성기
--    10자리 영문 대문자 + 숫자 (A-Z, 0-9 전부 사용).
--    코드는 서버가 만들고, 한 번 정해지면 바뀌지 않아요.
-- ------------------------------------------------------------
create or replace function public.gen_user_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result   text;
  i        int;
begin
  loop
    result := '';
    for i in 1..10 loop
      result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    -- 이미 있는 코드면 다시 뽑는다
    exit when not exists (select 1 from public.profiles where code = result);
  end loop;
  return result;
end;
$$;


-- ------------------------------------------------------------
-- 2. 프로필 테이블
--    code       : 고유 코드 (기본키, 변경 불가)
--    username   : 아이디 (변경 가능, 중복 불가)
--    login_email: 로그인에 쓰는 내부용 이메일 (사용자에게 보이지 않음)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  code        text primary key,
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  username    text not null,
  login_email text not null,
  created_at  timestamptz not null default now()
);

-- 아이디는 대소문자 구분 없이 중복을 막는다 (Minsu 와 minsu 는 같은 것으로 본다)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- 코드는 서버에서 자동 생성
alter table public.profiles
  alter column code set default public.gen_user_code();


-- ------------------------------------------------------------
-- 3. 고유 코드 변경 차단
--    실수로든 고의로든 코드는 절대 바뀌지 않게 막는다.
-- ------------------------------------------------------------
create or replace function public.prevent_code_change()
returns trigger
language plpgsql
as $$
begin
  if new.code is distinct from old.code then
    raise exception '고유 코드는 변경할 수 없습니다.';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception '계정 연결은 변경할 수 없습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_no_code_change on public.profiles;
create trigger profiles_no_code_change
  before update on public.profiles
  for each row execute function public.prevent_code_change();


-- ------------------------------------------------------------
-- 4. 학습 기록 테이블
-- ------------------------------------------------------------
create table if not exists public.progress (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  xp                integer not null default 0,
  streak            integer not null default 0,
  last_study_date   date,
  completed_lessons jsonb not null default '[]'::jsonb,
  lesson_best       jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 5. 보안 정책 (RLS)
--    "자기 것만 읽고 쓸 수 있다"를 데이터베이스 차원에서 강제한다.
--    이게 없으면 누구나 남의 기록을 볼 수 있으니 반드시 켜야 해요.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

drop policy if exists "본인 프로필 조회" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "본인 프로필 생성" on public.profiles;
create policy "본인 프로필 생성" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "본인 프로필 수정" on public.profiles;
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = user_id);

drop policy if exists "본인 기록 조회" on public.progress;
create policy "본인 기록 조회" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "본인 기록 생성" on public.progress;
create policy "본인 기록 생성" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "본인 기록 수정" on public.progress;
create policy "본인 기록 수정" on public.progress
  for update using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 6. 로그인 도우미 함수
--    아이디나 고유 코드로 로그인하려면 내부용 이메일을 찾아야 하는데,
--    프로필 테이블은 본인 것만 볼 수 있으니 로그인 전에는 조회가 안 된다.
--    그래서 이 함수만 예외적으로 조회 권한을 갖게 한다(security definer).
--    이메일 외의 정보는 절대 돌려주지 않는다.
-- ------------------------------------------------------------
create or replace function public.login_email_for(identifier text)
returns text
language sql
security definer
set search_path = public
as $$
  select login_email
  from public.profiles
  where lower(username) = lower(trim(identifier))
     or code = upper(regexp_replace(identifier, '[^A-Za-z0-9]', '', 'g'))
  limit 1;
$$;

-- 아이디 중복 확인용 (가입 화면에서 미리 알려주기 위함)
create or replace function public.username_taken(name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where lower(username) = lower(trim(name)));
$$;

grant execute on function public.login_email_for(text) to anon, authenticated;
grant execute on function public.username_taken(text)  to anon, authenticated;


-- ============================================================
--  설정 확인 사항
--
--  Authentication → Providers → Email 에서
--    "Confirm email" 을 꺼 주세요.
--    이 앱은 실제 이메일을 받지 않으므로, 켜져 있으면 가입 후 로그인이 막혀요.
-- ============================================================
