-- ============================================================
--  관리자 권한 추가
--
--  사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 Run
--  schema.sql 을 이미 실행한 뒤에 이 파일을 실행하세요.
--  여러 번 실행해도 안전합니다.
-- ============================================================


-- ------------------------------------------------------------
-- 1. 관리자 표시 칸 추가
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;


-- ------------------------------------------------------------
-- 2. "지금 로그인한 사람이 관리자인가?" 를 판단하는 함수
--
--    보안 정책 안에서 profiles 를 다시 조회하면 무한 반복에 빠진다.
--    security definer 로 만들어 그 문제를 피한다.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.user_id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- ------------------------------------------------------------
-- 3. 스스로 관리자가 되는 것을 막는다
--
--    일반 사용자는 자기 프로필을 수정할 수 있으므로,
--    막아두지 않으면 누구나 자신을 관리자로 올릴 수 있다.
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
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception '관리자 권한은 스스로 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 4. 관리자에게 열어주는 권한
--    기존 "본인 것만" 정책과 함께 적용된다(둘 중 하나만 맞으면 통과).
-- ------------------------------------------------------------
drop policy if exists "관리자 전체 프로필 조회" on public.profiles;
create policy "관리자 전체 프로필 조회" on public.profiles
  for select using (public.is_admin());

drop policy if exists "관리자 전체 기록 조회" on public.progress;
create policy "관리자 전체 기록 조회" on public.progress
  for select using (public.is_admin());

drop policy if exists "관리자 프로필 삭제" on public.profiles;
create policy "관리자 프로필 삭제" on public.profiles
  for delete using (public.is_admin());

drop policy if exists "관리자 기록 삭제" on public.progress;
create policy "관리자 기록 삭제" on public.progress
  for delete using (public.is_admin());


-- ============================================================
--  5. 관리자 지정
--
--  ★ 아래 아이디를 실제 아이디로 바꾼 뒤 실행하세요.
--    Table Editor → profiles 에서 정확한 username 을 확인할 수 있어요.
-- ============================================================
--  첫 관리자를 지정할 때는 3번의 안전장치를 잠시 꺼야 한다.
--  (아직 관리자가 아무도 없어서 그 장치에 스스로 걸리기 때문)
alter table public.profiles disable trigger profiles_no_code_change;

update public.profiles
set is_admin = true
where lower(username) = lower('seolon3626');

alter table public.profiles enable trigger profiles_no_code_change;

-- 제대로 지정됐는지 확인 (결과에 해당 아이디가 나와야 함)
select username, code, is_admin from public.profiles where is_admin = true;
