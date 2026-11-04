/* ============================================================
   비밀번호 찾기용 이메일 등록 서버 함수 (Supabase Edge Function)

   아이디로 가입한 계정은 내부용 가짜 이메일(@science-app.invalid)을 쓴다.
   브라우저에서 이메일을 바꾸려고 하면 Supabase 가 이 가짜 주소를
   "올바르지 않은 이메일"로 보고 거절한다. 그래서 서버에서 관리자 권한으로
   바꾼다. 호출한 사람이 로그인한 본인인지 먼저 확인한다.
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

function readKey(legacyName: string, modernName: string): string | undefined {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get(modernName) ?? "{}")["default"];
  } catch {
    return undefined;
  }
}

const FAKE_SUFFIX = "@science-app.invalid";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "잘못된 요청이에요." }, 405);

  // 1) 로그인한 본인인지 확인
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "로그인이 필요해요." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, readKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "로그인이 필요해요. 다시 로그인해 주세요." }, 401);

  // 2) 이메일 형식 확인
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "잘못된 요청이에요." }, 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(FAKE_SUFFIX)) {
    return json({ error: "이메일 형식이 올바르지 않아요." });
  }
  if ((user.email ?? "").toLowerCase() === email) return json({ ok: true, email });

  // 3) 관리자 권한으로 이메일 변경 (확인 메일 없이 바로 적용)
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  });
  if (updateError) {
    const msg = String(updateError.message ?? "");
    if (/already|registered|exists/i.test(msg)) return json({ error: "이미 다른 계정이 쓰고 있는 이메일이에요." });
    return json({ error: `이메일을 등록하지 못했어요. (${msg})` });
  }

  // 4) 아이디 로그인에 쓰는 이메일도 같이 맞춘다
  const { error: profileError } = await admin
    .from("profiles")
    .update({ login_email: email })
    .eq("user_id", user.id);
  if (profileError) return json({ error: `이메일은 바뀌었지만 프로필에 저장하지 못했어요. (${profileError.message})` });

  return json({ ok: true, email });
});
