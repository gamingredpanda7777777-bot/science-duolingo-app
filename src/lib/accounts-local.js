/* ============================================================
   계정 시스템

   중요 — 이 계정은 "이 기기 안에서만" 유효해요.
   서버가 없기 때문에 계정 정보가 사용자의 브라우저에만 저장돼요.
   따라서:
     - 다른 기기나 다른 브라우저에서는 로그인할 수 없어요.
     - 브라우저 저장소를 지우면 계정도 사라져요.
     - 마음먹은 사람은 개발자 도구로 저장된 값을 바꿔 로그인할 수 있어요.
   그래서 비밀번호는 반드시 이 앱에서만 쓰는 것으로 정해야 해요.
   진짜 계정(기기 간 로그인, 안전한 비밀번호 보관)이 필요하면 서버가 있어야 해요.
   ============================================================ */

import {
  CODE_LENGTH,
  formatCode,
  normalizeCode,
  generateCode,
  validateId,
  validatePassword,
} from "./accounts-shared.js";

export { formatCode, normalizeCode };

const ACCOUNTS_KEY = "science-app-accounts-v1";
const SESSION_KEY = "science-app-session-v1";


/* ---------- 저장소 ---------- */

function readStore() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function getSession() {
  try {
    return localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function setSession(code) {
  try {
    if (code) localStorage.setItem(SESSION_KEY, code);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 무시 */
  }
}


/* ---------- 비밀번호 ---------- */

/* SHA-256 해시. 저장소를 들여다봐도 비밀번호 원문은 보이지 않게 한다.
   (계정 보호가 아니라 '비밀번호 값 노출'을 막기 위한 것) */
export async function hashPassword(password, code) {
  const text = `${code}:${password}`;
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // crypto.subtle 을 못 쓰는 환경(http 등)에서의 대체 수단
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h << 5) - h + text.charCodeAt(i);
      h |= 0;
    }
    return "fallback-" + Math.abs(h).toString(16);
  }
}


/* ---------- 계정 조작 ---------- */

export async function createAccount(id, password) {
  const store = readStore();

  const idError = validateId(id, store);
  if (idError) return { error: idError };
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };

  const code = generateCode(store);
  const account = {
    code, // 고유 코드 — 한 번 정해지면 바뀌지 않는다
    id: String(id).trim(),
    passwordHash: await hashPassword(password, code),
    createdAt: new Date().toISOString(),
  };

  store[code] = account;
  if (!writeStore(store)) {
    return { error: "이 브라우저에서는 계정을 저장할 수 없어요. 비공개 모드인지 확인해 주세요." };
  }
  setSession(code);
  return { account };
}

/* 아이디 또는 고유 코드 + 비밀번호로 로그인 */
export async function login(idOrCode, password) {
  const store = readStore();
  const input = String(idOrCode || "").trim();

  let account = Object.values(store).find((a) => a.id.toLowerCase() === input.toLowerCase());
  if (!account) account = store[normalizeCode(input)];

  if (!account) return { error: "아이디 또는 고유 코드를 찾을 수 없어요." };

  const hash = await hashPassword(password, account.code);
  if (hash !== account.passwordHash) return { error: "비밀번호가 맞지 않아요." };

  setSession(account.code);
  return { account };
}

export async function logout() {
  setSession(null);
}

export async function getCurrentAccount() {
  return getAccount(getSession()) || null;
}

/* 로컬 모드에는 서버 동기화가 없다 — 인터페이스만 맞춰 둔다 */
export async function fetchProgress() {
  return null;
}
export async function pushProgress() {
  return true;
}

/* 로컬 모드에서는 구글 로그인과 랭킹을 쓸 수 없다 */
export async function signInWithGoogle() {
  return { error: "구글 로그인은 서버에 연결된 상태에서만 쓸 수 있어요." };
}
export async function fetchLeaderboard() {
  return { error: "랭킹은 서버에 연결된 상태에서만 볼 수 있어요." };
}

export function getAccount(code) {
  if (!code) return null;
  return readStore()[code] || null;
}

/* 아이디 변경 — 고유 코드는 그대로 */
export async function changeId(code, newId) {
  const store = readStore();
  const account = store[code];
  if (!account) return { error: "계정을 찾을 수 없어요." };

  const idError = validateId(newId, store, code);
  if (idError) return { error: idError };

  account.id = String(newId).trim();
  if (!writeStore(store)) return { error: "저장하지 못했어요." };
  return { account };
}

/* 비밀번호 변경 — 현재 비밀번호를 확인한다 */
export async function changePassword(code, currentPassword, newPassword) {
  const store = readStore();
  const account = store[code];
  if (!account) return { error: "계정을 찾을 수 없어요." };

  const currentHash = await hashPassword(currentPassword, code);
  if (currentHash !== account.passwordHash) return { error: "현재 비밀번호가 맞지 않아요." };

  const pwError = validatePassword(newPassword);
  if (pwError) return { error: pwError };

  account.passwordHash = await hashPassword(newPassword, code);
  if (!writeStore(store)) return { error: "저장하지 못했어요." };
  return { account };
}

/* 계정과 학습 기록을 함께 삭제 */
export async function deleteAccount(code) {
  const store = readStore();
  delete store[code];
  writeStore(store);
  try {
    localStorage.removeItem(`science-app-progress-v1:${code}`);
  } catch {
    /* 무시 */
  }
  setSession(null);
}

/* ---------- 비밀번호 찾기 (로컬 모드에서는 불가) ----------
   메일을 보낼 서버가 없으므로 기능을 제공하지 않는다.
   화면 쪽에서 서버 모드일 때만 버튼을 보여준다. */
export async function requestPasswordReset() {
  return { error: "이 기기 저장 모드에서는 비밀번호 찾기를 쓸 수 없어요." };
}
export function isRecoveryLink() {
  return false;
}
export async function completePasswordReset() {
  return { error: "이 기기 저장 모드에서는 비밀번호 찾기를 쓸 수 없어요." };
}
export async function getRecoveryEmail() {
  return null;
}
export async function setRecoveryEmail() {
  return { error: "이 기기 저장 모드에서는 이메일을 등록할 수 없어요." };
}

/* ---------- 관리자 기능 (로컬 모드에서는 없음) ---------- */
export async function fetchAllUsers() {
  return { error: "이 기기 저장 모드에서는 쓸 수 없어요." };
}
export async function adminResetProgress() {
  return { error: "이 기기 저장 모드에서는 쓸 수 없어요." };
}
export async function adminDeleteUser() {
  return { error: "이 기기 저장 모드에서는 쓸 수 없어요." };
}
