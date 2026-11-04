/* ============================================================
   서버(Supabase) 계정 모듈

   로컬 모듈(accounts-local.js)과 똑같은 함수 이름·반환 형태를 쓴다.
   그래서 accounts.js 가 둘 중 하나를 골라 끼우기만 하면 된다.

   계정 객체 형태: { code, id, createdAt }
     code : 고유 코드 (서버가 생성, 변경 불가)
     id   : 아이디 (변경 가능)
   ============================================================ */

import { supabase, syntheticEmail } from "./supabase.js";
import {
  validateId,
  validatePassword,
  validateEmail,
  isRecoverableEmail,
  normalizeCode,
  formatCode,
} from "./accounts-shared.js";

export { formatCode, normalizeCode };

function toAccount(row) {
  if (!row) return null;
  return {
    code: row.code,
    id: row.username,
    createdAt: row.created_at,
    isAdmin: Boolean(row.is_admin),
  };
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
    .select("code, username, created_at, is_admin, login_email")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (row) {
    // 이메일 변경 확인 링크를 누른 뒤에는 인증 쪽 이메일만 바뀌어 있다.
    // 아이디 로그인이 계속 되도록 프로필의 로그인용 이메일을 맞춰 둔다.
    const authEmail = data.user.email;
    if (authEmail && row.login_email !== authEmail) {
      await supabase.from("profiles").update({ login_email: authEmail }).eq("user_id", data.user.id);
    }
    return toAccount(row);
  }

  // 구글 로그인으로 처음 들어온 사람: 임시 아이디로 프로필을 만든다.
  // 사용자는 로그인 후 계정 화면에서 아이디를 바꿀 수 있다.
  const provider = data.user.app_metadata?.provider;
  if (!provider || provider === "email") return null;
  const username = `user_${Math.random().toString(36).slice(2, 8)}`;
  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      user_id: data.user.id,
      username,
      login_email: data.user.email || syntheticEmail(username),
    })
    .select("code, username, created_at, is_admin")
    .single();
  if (createError) {
    throw new Error(`구글 계정으로 프로필을 만들지 못했어요. (${createError.message})`);
  }
  return toAccount(created);
}

/* 구글 로그인: 구글 화면으로 이동했다가 이 앱으로 돌아온다 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) return { error: friendly(error, "구글 로그인을 시작하지 못했어요.") };
  return { ok: true };
}

/* 랭킹: 아이디와 경험치만 보여준다 (이메일, 코드 등은 내보내지 않는다) */
export async function fetchLeaderboard(limit = 20) {
  const { data, error } = await supabase.rpc("leaderboard", { row_limit: limit });
  if (error) return { error: friendly(error, "랭킹을 불러오지 못했어요.") };
  return {
    rows: (data || []).map((r) => ({ username: r.username, xp: r.xp, isMe: Boolean(r.is_me) })),
  };
}

/* ---------- 가입 ---------- */

export async function createAccount(id, password, recoveryEmail) {
  const username = String(id || "").trim();
  const email0 = String(recoveryEmail || "").trim();

  const idError = validateId(username);
  if (idError) return { error: idError };
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };
  if (email0) {
    const mailError = validateEmail(email0);
    if (mailError) return { error: mailError };
  }

  // 아이디 중복을 미리 확인 (가입 후 실패하면 계정만 남으므로)
  const { data: taken, error: checkError } = await supabase.rpc("username_taken", {
    name: username,
  });
  if (checkError) return { error: friendly(checkError, "아이디를 확인하지 못했어요.") };
  if (taken) return { error: "이미 쓰고 있는 아이디예요." };

  // 이메일을 적었으면 그걸 로그인용으로 쓴다(비밀번호 찾기가 가능해진다).
  // 안 적었으면 내부용 가짜 이메일을 만든다(비밀번호 찾기 불가).
  const seed = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const email = email0 || syntheticEmail(seed);

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
    .select("code, username, created_at, is_admin")
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
    .select("code, username, created_at, is_admin")
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

/* ---------- 비밀번호 찾기 ---------- */

/* 등록한 이메일로 재설정 링크를 보낸다.
   계정이 있는지 없는지는 알려주지 않는다(남의 가입 여부를 캐낼 수 없게). */
export async function requestPasswordReset(email) {
  const value = String(email || "").trim();
  const mailError = validateEmail(value);
  if (mailError) return { error: mailError };

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo });

  // 등록되지 않은 주소여도 똑같은 안내를 돌려준다
  if (error && !/not found|invalid/i.test(String(error.message))) {
    return { error: friendly(error, "메일을 보내지 못했어요.") };
  }
  return { sent: true };
}

/* 메일 링크를 타고 들어온 상태인지 확인한다 */
export function isRecoveryLink() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const query = window.location.search || "";
  return /type=recovery/.test(hash) || /type=recovery/.test(query);
}

/* 링크로 들어온 뒤 새 비밀번호를 저장한다 */
export async function completePasswordReset(newPassword) {
  const pwError = validatePassword(newPassword);
  if (pwError) return { error: pwError };

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return { error: "링크가 만료됐어요. 비밀번호 찾기를 다시 시도해 주세요." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: friendly(error, "비밀번호를 바꾸지 못했어요.") };

  // 주소창에 남은 토큰을 지운다
  try {
    window.history.replaceState({}, "", window.location.pathname);
  } catch {
    /* 무시 */
  }
  return { ok: true };
}

/* 지금 계정에 복구용 이메일이 등록돼 있는지 */
export async function getRecoveryEmail() {
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email || null;
  return isRecoverableEmail(email) ? email : null;
}

/* 이미 만든 계정에 복구용 이메일을 등록하거나 바꾼다 */
export async function setRecoveryEmail(code, email) {
  const value = String(email || "").trim();
  const mailError = validateEmail(value);
  if (mailError) return { error: mailError };

  const { data, error } = await supabase.auth.updateUser({ email: value });
  if (error) {
    const msg = String(error.message || "");
    if (/already|registered|exists/i.test(msg)) return { error: "이미 다른 계정이 쓰고 있는 이메일이에요." };
    if (/rate limit|too many/i.test(msg)) return { error: "메일 발송 횟수 제한에 걸렸어요. 잠시 후 다시 시도해 주세요." };
    return { error: `이메일을 등록하지 못했어요. (${msg || "알 수 없는 오류"})` };
  }

  // 확인 메일이 필요한 설정이면, 링크를 누르기 전까지 이메일은 바뀌지 않는다.
  // 이때 프로필의 로그인용 이메일을 먼저 바꾸면 아이디 로그인이 막히므로 그대로 둔다.
  const applied = (data?.user?.email || "").toLowerCase() === value.toLowerCase();
  if (!applied) return { pending: true };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ login_email: value })
    .eq("code", code);
  if (profileError) return { error: `이메일은 바뀌었지만 프로필에 저장하지 못했어요. (${profileError.message})` };
  return { ok: true };
}

/* ---------- 관리자 기능 ----------
   아래 함수들은 데이터베이스의 보안 정책이 최종 판단을 한다.
   관리자가 아니면 서버가 빈 결과를 돌려주므로, 화면에서 숨기는 것만으로
   막는 것이 아니라 실제로 접근이 차단된다. */

/* 전체 사용자와 학습 기록을 함께 가져온다 */
export async function fetchAllUsers() {
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("code, username, created_at, is_admin, user_id")
    .order("created_at", { ascending: true });

  if (pErr) return { error: friendly(pErr, "사용자 목록을 불러오지 못했어요.") };

  const { data: progressRows, error: gErr } = await supabase
    .from("progress")
    .select("user_id, xp, streak, last_study_date, completed_lessons, lesson_best");

  if (gErr) return { error: friendly(gErr, "학습 기록을 불러오지 못했어요.") };

  const byUser = {};
  for (const row of progressRows || []) byUser[row.user_id] = row;

  const users = (profiles || []).map((p) => {
    const g = byUser[p.user_id] || {};
    return {
      code: p.code,
      id: p.username,
      isAdmin: Boolean(p.is_admin),
      createdAt: p.created_at,
      xp: g.xp ?? 0,
      streak: g.streak ?? 0,
      lastStudyDate: g.last_study_date ?? null,
      completedLessons: Array.isArray(g.completed_lessons) ? g.completed_lessons : [],
      lessonBest: g.lesson_best && typeof g.lesson_best === "object" ? g.lesson_best : {},
    };
  });

  return { users };
}

/* 다른 사람의 학습 기록만 지운다 (계정은 남는다) */
export async function adminResetProgress(code) {
  const { data: row, error: findError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("code", code)
    .single();
  if (findError || !row) return { error: "그 계정을 찾지 못했어요." };

  const { error } = await supabase.from("progress").delete().eq("user_id", row.user_id);
  if (error) return { error: friendly(error, "기록을 지우지 못했어요.") };
  return { ok: true };
}

/* 다른 사람의 계정을 지운다.
   브라우저에서는 로그인 정보 자체를 지울 수 없으므로 프로필과 기록만 지운다.
   남은 로그인 정보는 Supabase 대시보드에서 정리해야 한다. */
export async function adminDeleteUser(code) {
  const { data: row, error: findError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("code", code)
    .single();
  if (findError || !row) return { error: "그 계정을 찾지 못했어요." };

  await supabase.from("progress").delete().eq("user_id", row.user_id);
  const { error } = await supabase.from("profiles").delete().eq("code", code);
  if (error) return { error: friendly(error, "계정을 지우지 못했어요.") };

  return { ok: true, needsDashboardCleanup: true };
}
