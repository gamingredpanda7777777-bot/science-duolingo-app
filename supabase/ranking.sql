-- ============================================================
--  랭킹 함수
--
--  사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 Run
--  schema.sql 을 먼저 실행한 뒤 실행하세요. 여러 번 실행해도 안전합니다.
--
--  학습 기록 표는 본인만 읽을 수 있어서, 랭킹용으로 "아이디 + 경험치"만
--  돌려주는 함수를 따로 만든다. 다른 정보(이메일, 코드, 기록 상세)는 내보내지 않는다.
-- ============================================================

create or replace function public.leaderboard(row_limit int default 20)
returns table (username text, xp integer, is_me boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.username,
         pr.xp,
         (p.user_id = auth.uid()) as is_me
  from public.progress pr
  join public.profiles p on p.user_id = pr.user_id
  order by pr.xp desc, pr.updated_at asc
  limit least(greatest(row_limit, 1), 50);
$$;

grant execute on function public.leaderboard(int) to anon, authenticated;
