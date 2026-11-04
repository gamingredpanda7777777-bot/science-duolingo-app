/* ============================================================
   로그인 서버 함수 (Supabase Edge Function)

   아이디(또는 고유 코드)와 비밀번호를 받아 서버 안에서만
   로그인용 이메일을 찾고 로그인한 뒤, 세션 토큰만 돌려준다.
   → 브라우저는 다른 사람의 이메일 주소를 볼 수 없다.

   실패 이유(아이디 없음 / 비밀번호 틀림)는 구분하지 않고 같은 문구를 쓴다.
   어떤 아이디가 가입돼 있는지 알아내는 데 쓰이지 않게 하기 위해서다.
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/* 예전 키(SUPABASE_ANON_KEY 등)가 있으면 쓰고, 없으면 새 키 묶음에서 default 를 쓴다 */
function readKey(legacyName: string, modernName: string): string | undefined {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get(modernName) ?? "{}")["default"];
  } catch {
    return undefined;
  }
}

const WRONG = "아이디 또는 비밀번호가 맞지 않아요.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "잘못된 요청이에요." }, 405);

  let identifier = "";
  let password = "";
  try {
    const body = await req.json();
    identifier = String(body?.identifier ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    return json({ error: "잘못된 요청이에요." }, 400);
  }
  if (!identifier || !password || identifier.length > 64 || password.length > 128) {
    return json({ error: WRONG });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

  // 1) 아이디/코드 → 로그인용 이메일 (서버 안에서만 쓰고 밖으로 내보내지 않는다)
  const admin = createClient(url, readKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS")!, noSession);
  const { data: email, error: lookupError } = await admin.rpc("login_email_for", { identifier });
  if (lookupError) return json({ error: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);
  if (!email) return json({ error: WRONG });

  // 2) 비밀번호 확인 후 세션 발급
  const pub = createClient(url, readKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS")!, noSession);
  const { data, error } = await pub.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const msg = String(error?.message ?? "");
    if (/Email not confirmed/i.test(msg)) {
      return json({ error: "이메일 확인 설정이 켜져 있어요. Supabase 설정에서 Confirm email 을 꺼 주세요." });
    }
    if (/rate limit|too many/i.test(msg)) {
      return json({ error: "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    return json({ error: WRONG });
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
