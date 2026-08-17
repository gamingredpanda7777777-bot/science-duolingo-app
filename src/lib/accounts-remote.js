/* ============================================================
   서버(Supabase) 계정 모듈

   로컬 모듈(accounts-local.js)과 똑같은 함수 이름·반환 형태를 쓴다.
   그래서 accounts.js 가 둘 중 하나를 골라 끼우기만 하면 된다.

   계정 객체 형태: { code, id, createdAt }
     code : 고유 코드 (서버가 생성, 변경 불가)
     id   : 아이디 (변경 가능)
   ============================================================ */

import { supabase, syntheticEmail } from "./supabase.js";
import { validateId, validatePassword, normalizeCode, formatCode } from "./accounts-shared.js";

export { formatCode, normalizeCode };

function toAccount(row) {
  if (!row) return null;
  return { code: row.code, id: row.username, createdAt: row.created_at };
}

/* 서버 오류 메시지를 사람이 읽을 수 있게 바꾼다 */
function friendly(error, fallback) {
  const msg = String(error?.message || "");
  if (/Invalid login credentials/i.test(msg)) return "아이디 또는 비밀번호가 맞지 않아요.";
  if (/already registered|already exists/i.test(msg)) return "이미 쓰고 있는 아이디예요.";
  if (/Email not confirmed/i.test(msg))
    return "이메일 확인 설정이 켜져 있어요. Supabase 설정에서 Confirm email 을 꺼 주세요.";
  if (/Password should be/i.test(msg)) return "비밀번호는 6자 이상으로 정해 주세요.";
  if (/fetch|network|Failed to fetch/i.test(msg)) return "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  return fallback || msg || "알 수 없는 오류가 생겼어요.";
}

/* ---------- 세션 ---------- */

export async function getCurrentAccount() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select("code, username, created_at")
    .eq("user_id", data.user.id)
    .single();
  return toAccount(row);
}

/* ---------- 가입 ---------- */

export async function createAccount(id, password) {
  const username = String(id || "").trim();

  const idError = validateId(username);
  if (idError) return { error: idError };
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };

  // 아이디 중복을 미리 확인 (가입 후 실패하면 계정만 남으므로)
  const { data: taken, error: checkError } = await supabase.rpc("username_taken", {
    name: username,
  });
  if (checkError) return { error: friendly(checkError, "아이디를 확인하지 못했어요.") };
  if (taken) return { error: "이미 쓰고 있는 아이디예요." };

  // 로그인용 내부 이메일. 아이디를 바꿔도 이 값은 그대로 유지된다.
  const seed = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const email = syntheticEmail(seed);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) return { error: friendly(signUpError, "계정을 만들지 못했어요.") };

  const user = signUpData.user;
  if (!user) return { error: "계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요." };

  // 프로필 생성 — code 는 서버가 자동으로 만든다
  const { data: row, error: profileError } = await supabase
    .from("profiles")
    .insert({ user_id: user.id, username, login_email: email })
    .select("code, username, created_at")
    .single();

  if (profileError) {
    return { error: friendly(profileError, "프로필을 만들지 못했어요.") };
  }

  return { account: toAccount(row) };
}

/* ---------- 로그인 ---------- */

export async function login(idOrCode, password) {
  const identifier = String(idOrCode || "").trim();
  if (!identifier) return { error: "아이디 또는 고유 코드를 입력해 주세요." };

  // 아이디/코드 → 내부 이메일 찾기
  const { data: email, error: lookupError } = await supabase.rpc("login_email_for", {
    identifier,
  });
  if (lookupError) return { error: friendly(lookupError, "로그인하지 못했어요.") };
  if (!email) return { error: "아이디 또는 고유 코드를 찾을 수 없어요." };

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: friendly(signInError, "로그인하지 못했어요.") };

  const account = await getCurrentAccount();
  if (!account) return { error: "프로필을 불러오지 못했어요." };
  return { account };
}

export async function logout() {
  await supabase.auth.signOut();
}

/* ---------- 변경 ---------- */

export async function changeId(code, newId) {
  const username = String(newId || "").trim();

  const idError = validateId(username);
  if (idError) return { error: idError };

  const { data: taken } = await supabase.rpc("username_taken", { name: username });
  if (taken) {
    const current = await getCurrentAccount();
    if (!current || current.id.toLowerCase() !== username.toLowerCase()) {
      return { error: "이미 쓰고 있는 아이디예요." };
    }
  }

  // code 는 건드리지 않는다. 서버 트리거가 변경을 막고 있기도 하다.
  const { data: row, error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("code", code)
    .select("code, username, created_at")
    .single();

  if (error) return { error: friendly(error, "아이디를 바꾸지 못했어요.") };
  return { account: toAccount(row) };
}

export async function changePassword(code, currentPassword, newPassword) {
  const pwError = validatePassword(newPassword);
  if (pwError) return { error: pwError };

  // 현재 비밀번호 확인 — 지금 로그인한 계정으로 한 번 더 로그인해 본다
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email;
  if (!email) return { error: "로그인 상태가 아니에요." };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) return { error: "현재 비밀번호가 맞지 않아요." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: friendly(error, "비밀번호를 바꾸지 못했어요.") };

  const account = await getCurrentAccount();
  return { account };
}

export async function deleteAccount() {
  // 브라우저에서는 계정을 완전히 지울 수 없다(관리자 권한 필요).
  // 기록만 비우고 로그아웃한다.
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    await supabase.from("progress").delete().eq("user_id", data.user.id);
  }
  await supabase.auth.signOut();
  return { needsManualDeletion: true };
}

/* ---------- 학습 기록 동기화 ---------- */

export async function fetchProgress() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data, error } = await supabase
    .from("progress")
    .select("xp, streak, last_study_date, completed_lessons, lesson_best")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    xp: data.xp ?? 0,
    streak: data.streak ?? 0,
    lastStudyDate: data.last_study_date ?? null,
    completedLessons: Array.isArray(data.completed_lessons) ? data.completed_lessons : [],
    lessonBest: data.lesson_best && typeof data.lesson_best === "object" ? data.lesson_best : {},
  };
}

export async function pushProgress(progress) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return false;

  const { error } = await supabase.from("progress").upsert(
    {
      user_id: userData.user.id,
      xp: progress.xp,
      streak: progress.streak,
      last_study_date: progress.lastStudyDate,
      completed_lessons: progress.completedLessons,
      lesson_best: progress.lessonBest,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return !error;
}
