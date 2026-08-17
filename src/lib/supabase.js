/* ============================================================
   Supabase 연결

   .env 파일에 키가 들어 있으면 서버 모드로,
   없으면 이 기기에만 저장하는 로컬 모드로 동작한다.
   덕분에 키 없이도 앱이 그대로 돌아간다.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

/* 서버 모드인지 여부 — 화면에서 안내 문구를 바꿀 때 쓴다 */
export const isServerMode = Boolean(supabase);

/* 아이디로 로그인하기 위한 내부용 이메일.
   실제로 메일이 오가지는 않는다. */
export function syntheticEmail(seed) {
  return `${seed}@science-app.invalid`;
}
