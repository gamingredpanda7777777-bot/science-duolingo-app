import React, { useState, useEffect } from "react";
import {
  Home as HomeIcon,
  BookOpen,
  TrendingUp,
  User,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Flame,
  Lock,
  Beaker,
  Dna,
} from "lucide-react";

/* ============================================================
   로컬 모드와 서버 모드가 함께 쓰는 규칙
   ============================================================ */

/* 알파벳 26자 + 숫자 10자 전부 사용 */
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 10;

/* 보기 좋게 4-3-3 으로 끊어 표시 */
function formatCode(code) {
  if (!code || code.length !== CODE_LENGTH) return code || "";
  return `${code.slice(0, 4)}-${code.slice(4, 7)}-${code.slice(7)}`;
}

function normalizeCode(input) {
  return String(input || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/* 로컬 모드에서만 쓴다. 서버 모드에서는 서버가 코드를 만든다. */
function generateCode(existing = {}) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    const buf = new Uint32Array(CODE_LENGTH);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    } else {
      for (let i = 0; i < CODE_LENGTH; i++)
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing[code]) return code;
  }
  return (Date.now().toString(36).toUpperCase() + "XXXXXXXXXX").slice(0, CODE_LENGTH);
}

/* store 를 주면 중복까지 검사한다(로컬 모드). 서버 모드에서는 서버가 중복을 본다. */
function validateId(id, store = null, exceptCode = null) {
  const value = String(id || "").trim();
  if (value.length < 4 || value.length > 16) return "아이디는 4~16자로 정해 주세요.";
  if (!/^[A-Za-z0-9_]+$/.test(value)) return "아이디는 영문, 숫자, _ 만 쓸 수 있어요.";
  if (store) {
    const taken = Object.values(store).some(
      (a) => a.id.toLowerCase() === value.toLowerCase() && a.code !== exceptCode
    );
    if (taken) return "이미 쓰고 있는 아이디예요.";
  }
  return null;
}

function validatePassword(pw) {
  const value = String(pw || "");
  if (value.length < 6) return "비밀번호는 6자 이상으로 정해 주세요.";
  if (value.length > 64) return "비밀번호가 너무 길어요.";
  return null;
}

/* 내부용 가짜 이메일에 붙는 꼬리표. 이 주소로는 메일을 받을 수 없다. */
const FAKE_MAIL_SUFFIX = "@science-app.invalid";

function isRecoverableEmail(email) {
  const value = String(email || "").trim();
  return Boolean(value) && !value.endsWith(FAKE_MAIL_SUFFIX);
}

function validateEmail(email) {
  const value = String(email || "").trim();
  if (!value) return "이메일을 입력해 주세요.";
  if (value.endsWith(FAKE_MAIL_SUFFIX)) return "사용할 수 없는 주소예요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "이메일 형식이 올바르지 않아요.";
  if (value.length > 254) return "이메일이 너무 길어요.";
  return null;
}

/* ============================================================
   계정 시스템

   ⚠️ 중요 — 이 계정은 "이 기기 안에서만" 유효해요.
   서버가 없기 때문에 계정 정보가 사용자의 브라우저에만 저장돼요.
   따라서:
     - 다른 기기나 다른 브라우저에서는 로그인할 수 없어요.
     - 브라우저 저장소를 지우면 계정도 사라져요.
     - 마음먹은 사람은 개발자 도구로 저장된 값을 바꿔 로그인할 수 있어요.
   그래서 비밀번호는 반드시 이 앱에서만 쓰는 것으로 정해야 해요.
   진짜 계정(기기 간 로그인, 안전한 비밀번호 보관)이 필요하면 서버가 있어야 해요.
   ============================================================ */


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

function getSession() {
  try {
    return localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function setSession(code) {
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
async function hashPassword(password, code) {
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

async function createAccount(id, password) {
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
async function login(idOrCode, password) {
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

async function logout() {
  setSession(null);
}

async function getCurrentAccount() {
  return getAccount(getSession()) || null;
}

/* 로컬 모드에는 서버 동기화가 없다 — 인터페이스만 맞춰 둔다 */
async function fetchProgress() {
  return null;
}
async function pushProgress() {
  return true;
}

function getAccount(code) {
  if (!code) return null;
  return readStore()[code] || null;
}

/* 아이디 변경 — 고유 코드는 그대로 */
async function changeId(code, newId) {
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
async function changePassword(code, currentPassword, newPassword) {
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
async function deleteAccount(code) {
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
async function requestPasswordReset() {
  return { error: "이 기기 저장 모드에서는 비밀번호 찾기를 쓸 수 없어요." };
}
function isRecoveryLink() {
  return false;
}
async function completePasswordReset() {
  return { error: "이 기기 저장 모드에서는 비밀번호 찾기를 쓸 수 없어요." };
}
async function getRecoveryEmail() {
  return null;
}
async function setRecoveryEmail() {
  return { error: "이 기기 저장 모드에서는 이메일을 등록할 수 없어요." };
}

/* ---------- 관리자 기능 (로컬 모드에서는 없음) ---------- */
async function fetchAllUsers() {
  return { error: "이 기기 저장 모드에서는 쓸 수 없어요." };
}
async function adminResetProgress() {
  return { error: "이 기기 저장 모드에서는 쓸 수 없어요." };
}
async function adminDeleteUser() {
  return { error: "이 기기 저장 모드에서는 쓸 수 없어요." };
}

/* ============================================================
   학습 기록 저장 — 계정 없이 기기에만 저장한다.
   localStorage를 쓸 수 없는 환경(사파리 비공개 모드 등)에서도
   앱이 죽지 않도록 모든 접근을 try/catch로 감싼다.
   ============================================================ */

const KEY_PREFIX = "science-app-progress-v1";

/* 계정별로 따로 저장한다. 계정이 없으면(로그아웃 상태) 공용 키를 쓴다. */
function keyFor(code) {
  return code ? `${KEY_PREFIX}:${code}` : KEY_PREFIX;
}

const EMPTY = {
  xp: 0,
  completedLessons: [],
  lessonBest: {}, // { [lessonId]: { correct, total } }
  streak: 0,
  lastStudyDate: null, // "YYYY-MM-DD"
  questionStats: {}, // { [questionId]: { attempts, wrongCount } } — 오늘의 랜덤 10 이 이걸로 뽑힌다
  dailyChallenge: null, // { date, questionIds, done, correctIds, wrongIds }
};

/* 기기의 로컬 날짜 기준 YYYY-MM-DD */
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(aKey, bKey) {
  const a = new Date(aKey + "T00:00:00");
  const b = new Date(bKey + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function loadProgress(code) {
  try {
    const raw = localStorage.getItem(keyFor(code));
    if (!raw) return { ...EMPTY };
    const saved = JSON.parse(raw);
    return {
      ...EMPTY,
      ...saved,
      completedLessons: Array.isArray(saved.completedLessons) ? saved.completedLessons : [],
      lessonBest: saved.lessonBest && typeof saved.lessonBest === "object" ? saved.lessonBest : {},
      questionStats:
        saved.questionStats && typeof saved.questionStats === "object" ? saved.questionStats : {},
      dailyChallenge: saved.dailyChallenge && typeof saved.dailyChallenge === "object" ? saved.dailyChallenge : null,
    };
  } catch {
    // 저장된 값이 깨졌거나 localStorage를 못 쓰는 경우 → 빈 기록으로 시작
    return { ...EMPTY };
  }
}

function saveProgress(progress, code) {
  try {
    localStorage.setItem(keyFor(code), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

function resetProgress(code) {
  try {
    localStorage.removeItem(keyFor(code));
  } catch {
    /* 무시 */
  }
  return { ...EMPTY };
}

/* 레벨: 경험치 100마다 1레벨 */
function levelOf(xp) {
  return Math.floor(xp / 100) + 1;
}
function xpIntoLevel(xp) {
  return xp % 100;
}

/* 문제별 시도 기록을 갱신한다. 정답은 attempts만, 오답은 attempts와
   wrongCount를 함께 올린다 — "한 번이라도 틀린 적 있는 문제"를 가려내는 값이다. */
function recordAnswers(stats, correctIds, wrongIds) {
  const next = { ...stats };
  for (const id of correctIds || []) {
    const cur = next[id] || { attempts: 0, wrongCount: 0 };
    next[id] = { attempts: cur.attempts + 1, wrongCount: cur.wrongCount };
  }
  for (const id of wrongIds || []) {
    const cur = next[id] || { attempts: 0, wrongCount: 0 };
    next[id] = { attempts: cur.attempts + 1, wrongCount: cur.wrongCount + 1 };
  }
  return next;
}

function nextStreak(progress, today) {
  let streak = progress.streak || 0;
  if (progress.lastStudyDate === today) {
    streak = streak || 1;
  } else if (progress.lastStudyDate && daysBetween(progress.lastStudyDate, today) === 1) {
    streak = streak + 1;
  } else {
    streak = 1;
  }
  return streak;
}

/* 레슨을 끝냈을 때 기록을 갱신한 새 객체를 돌려준다 */
function applyLessonResult(progress, lessonId, result) {
  const today = todayKey();
  const correctIds = result.correctIds || [];
  const total = result.total;

  // 최고 기록만 갱신
  const prevBest = progress.lessonBest[lessonId];
  const lessonBest = { ...progress.lessonBest };
  if (!prevBest || correctIds.length > prevBest.correct) {
    lessonBest[lessonId] = { correct: correctIds.length, total };
  }

  return {
    ...progress,
    xp: (progress.xp || 0) + correctIds.length * 10,
    completedLessons: progress.completedLessons.includes(lessonId)
      ? progress.completedLessons
      : [...progress.completedLessons, lessonId],
    lessonBest,
    streak: nextStreak(progress, today),
    lastStudyDate: today,
    questionStats: recordAnswers(progress.questionStats, result.correctIds, result.wrongIds),
  };
}

/* ============================================================
   오늘의 랜덤 10 — 이미 풀어본 문제 중에서만 뽑는다.
   한 번이라도 틀린 적 있는 문제는 그렇지 않은 문제보다 2배 더 잘 뽑히게 한다.
   ============================================================ */

const DAILY_COUNT = 10;
/* 이만큼은 풀어봐야 "오늘의 랜덤 10"이 열린다 — 너무 적으면 매일 같은 문제만 나온다 */
const DAILY_MIN_SOLVED = 5;

/* Efraimidis–Spirakis 가중 무작위 비복원추출.
   가중치가 2배인 항목은 대략 2배 자주(먼저) 뽑히면서도, 매번 순서가 달라진다. */
function weightedSample(items, weightOf, k) {
  const keyed = items.map((item) => ({
    item,
    key: Math.pow(Math.random(), 1 / weightOf(item)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, k).map((x) => x.item);
}

/* 계정의 진도(questionStats)에 맞춰 오늘 풀 10문제의 id를 고른다.
   allQuestions: [{ id, ... }] — 전체 문제 목록(단원 무관하게 한 번 다 풀어놓은 것). */
function pickDailyQuestionIds(progress, allQuestions) {
  const stats = progress.questionStats || {};
  const solved = allQuestions.filter((q) => stats[q.id] && stats[q.id].attempts > 0);
  if (solved.length < DAILY_MIN_SOLVED) return [];
  const chosen = weightedSample(
    solved,
    (q) => (stats[q.id].wrongCount > 0 ? 2 : 1),
    Math.min(DAILY_COUNT, solved.length)
  );
  return chosen.map((q) => q.id);
}

/* 오늘 날짜의 랜덤 10을 이미 만들어뒀으면 그대로 쓰고, 없으면 새로 만든다.
   같은 날 안에서는 앱을 다시 열어도 같은 10문제가 나온다. */
function ensureDailyChallenge(progress, allQuestions) {
  const today = todayKey();
  const existing = progress.dailyChallenge;
  // 오늘 것이 이미 있고, 비어있지 않거나 이미 풀었다면 그대로 둔다(같은 날엔 고정).
  // 아직 문제를 충분히 못 풀어 비어있던 경우엔, 그 뒤 더 풀었을 수 있으니 다시 계산한다.
  if (existing && existing.date === today && (existing.questionIds.length > 0 || existing.done)) {
    return progress;
  }
  const questionIds = pickDailyQuestionIds(progress, allQuestions);
  return {
    ...progress,
    dailyChallenge: { date: today, questionIds, done: false, correctIds: [], wrongIds: [] },
  };
}

/* 오늘의 랜덤 10을 풀고 났을 때 기록을 갱신한다.
   레슨 완료 기록(completedLessons/lessonBest)은 건드리지 않는다 — 정식 레슨이 아니라서다. */
function applyDailyChallengeResult(progress, result) {
  const today = todayKey();
  return {
    ...progress,
    xp: (progress.xp || 0) + result.correctIds.length * 10,
    streak: nextStreak(progress, today),
    lastStudyDate: today,
    questionStats: recordAnswers(progress.questionStats, result.correctIds, result.wrongIds),
    dailyChallenge: {
      date: today,
      questionIds: progress.dailyChallenge?.questionIds || [
        ...result.correctIds,
        ...result.wrongIds,
      ],
      done: true,
      correctIds: result.correctIds,
      wrongIds: result.wrongIds,
    },
  };
}

/* 물리 — 운동과 에너지 문제 */

const MOTION_LESSON_QUESTIONS = [
  {
    id: "std_2_3_3_a_lo_a1_q01",
    difficulty: "easy",
    stem: "자전거가 직선 도로를 일정한 속력으로 달리고 있다. 등속 운동에 대한 설명으로 옳은 것은?",
    choices: [
      "시간-거리 그래프가 원점을 지나는 직선이다.",
      "시간이 지날수록 속력이 점점 커진다.",
      "시간-속력 그래프가 원점을 지나는 우상향 직선이다.",
      "단위 시간당 이동 거리가 시간이 지나면서 변한다.",
    ],
    answerIndex: 0,
    explanation:
      "등속 운동은 단위 시간당 이동 거리가 일정하므로, 시간-거리 그래프는 원점에서 출발해 일정한 기울기로 우상향하는 직선이에요.",
  },
  {
    id: "std_2_3_3_a_lo_a1_q02",
    difficulty: "easy",
    stem: "등속 운동을 하는 물체의 시간-속력 그래프의 모양으로 가장 알맞은 것은?",
    choices: [
      "원점을 지나는 우상향 직선",
      "시간 축에 나란한 수평선",
      "포물선 모양의 곡선",
      "원점을 지나지 않는 우하향 직선",
    ],
    answerIndex: 1,
    explanation:
      "등속 운동은 속력이 일정하게 유지되므로, 시간-속력 그래프는 시간 축과 나란한 수평선 모양이에요.",
  },
  {
    id: "std_2_3_3_a_lo_a1_q03",
    difficulty: "medium",
    stem: "어떤 자동차가 4초 동안 80m를 등속으로 이동했다. 이 자동차의 속력은?",
    choices: ["10 m/s", "20 m/s", "40 m/s", "320 m/s"],
    answerIndex: 1,
    explanation:
      "등속 운동의 속력 = 이동 거리 ÷ 걸린 시간이에요. 80m ÷ 4s = 20 m/s 이에요.",
  },
  {
    id: "std_2_3_3_a_lo_a1_q04",
    difficulty: "medium",
    stem: "시속 36km로 등속 주행하는 버스가 있다. 이 버스가 5초 동안 이동하는 거리는?",
    choices: ["10 m", "36 m", "50 m", "180 m"],
    answerIndex: 2,
    explanation:
      "36 km/h를 m/s로 바꾸면 36000m ÷ 3600s = 10 m/s예요. 등속 운동이므로 거리 = 속력 × 시간 = 10 m/s × 5s = 50 m 이에요.",
  },
  {
    id: "std_2_3_3_a_lo_a1_q05",
    difficulty: "hard",
    stem:
      "두 물체 A, B가 같은 지점에서 같은 방향으로 동시에 출발해 등속 운동을 한다. A는 속력 6 m/s, B는 속력 4 m/s이다. 두 물체 사이의 거리가 20m가 되는 것은 출발 후 몇 초 뒤인가?",
    choices: ["4초", "8초", "10초", "20초"],
    answerIndex: 2,
    explanation:
      "두 물체의 거리 차는 (6-4) m/s = 2 m/s의 속력으로 벌어져요. 20m ÷ 2 m/s = 10초 뒤에 거리가 20m가 돼요.",
  },
];

/* 생명과학 4단원 — 감각 기관 (눈 · 귀 · 피부 · 혀 · 코) */

/* ============================================================
   눈 구조 다이어그램 (문제용 · 직접 그린 SVG)
   A 각막 / B 수정체 / C 유리체 / D 망막
   ============================================================ */
const EYE_DIAGRAM_SVG = `
<svg viewBox="0 0 420 290" width="100%" style="max-width:340px">
  <ellipse cx="215" cy="145" rx="108" ry="108" fill="#FFFFFF" stroke="#A2A2B5" stroke-width="2"/>
  <path d="M155 62 A 95 95 0 1 1 155 228" fill="none" stroke="#F25C75" stroke-width="6" stroke-linecap="round"/>
  <path d="M155 70 Q 92 145 155 220 Z" fill="#E5F1FD" stroke="#4FA8F5" stroke-width="2.5"/>
  <ellipse cx="170" cy="145" rx="17" ry="38" fill="#D7ECFB" stroke="#4FA8F5" stroke-width="2.5"/>
  <path d="M148 78 L148 212" stroke="#9B8DF0" stroke-width="7" stroke-linecap="round"/>
  <path d="M300 195 L360 225 L360 250 L296 218 Z" fill="#FFE7A8" stroke="#E0B93A" stroke-width="2"/>
  <circle cx="112" cy="145" r="5" fill="#1F2030"/>
  <text x="72" y="120" font-size="17" font-weight="700" fill="#1F2030">A</text>
  <line x1="80" y1="126" x2="108" y2="142" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="170" cy="145" r="5" fill="#1F2030"/>
  <text x="168" y="52" font-size="17" font-weight="700" fill="#1F2030">B</text>
  <line x1="172" y1="58" x2="172" y2="108" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="245" cy="145" r="5" fill="#1F2030"/>
  <text x="243" y="52" font-size="17" font-weight="700" fill="#1F2030">C</text>
  <line x1="247" y1="58" x2="247" y2="139" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="308" cy="145" r="5" fill="#1F2030"/>
  <text x="352" y="120" font-size="17" font-weight="700" fill="#1F2030">D</text>
  <line x1="352" y1="126" x2="313" y2="142" stroke="#1F2030" stroke-width="1.5"/>
</svg>`;

/* ============================================================
   생명과학 — 감각 기관(눈) 문제
   레슨 1: 눈의 구조와 물체를 보는 과정 (5문제)
   ============================================================ */
const EYE_STRUCTURE_QUESTIONS = [
  {
    id: "std_bio_sense_a_lo_e1_q01",
    difficulty: "easy",
    stem: "우리가 눈에서 받아들이는 자극과, 그 자극으로 느끼는 감각을 바르게 짝지은 것은?",
    choices: [
      "소리 — 시각",
      "빛 — 청각",
      "빛 — 시각",
      "온도 — 시각",
    ],
    answerIndex: 2,
    explanation:
      "눈은 빛을 자극으로 받아들여요. 이렇게 빛을 받아들여 사물의 모양, 색깔, 거리 등을 느끼는 감각을 시각이라고 해요.",
  },
  {
    id: "std_bio_sense_a_lo_e1_q02",
    difficulty: "medium",
    svg: EYE_DIAGRAM_SVG,
    stem: "그림은 눈의 구조를 나타낸 것이다. 빛을 자극으로 받아들이는 시각 세포가 분포하는 곳은?",
    choices: ["A (각막)", "B (수정체)", "C (유리체)", "D (망막)"],
    answerIndex: 3,
    explanation:
      "시각 세포는 눈 안쪽 벽을 이루는 망막(D)에 있어요. 각막과 수정체는 빛을 굴절시키고, 유리체는 눈 속을 채워 모양을 유지하는 역할을 해요.",
  },
  {
    id: "std_bio_sense_a_lo_e1_q03",
    difficulty: "medium",
    stem: "물체에서 나온 빛이 눈으로 들어와 뇌까지 전달되는 순서로 옳은 것은?",
    choices: [
      "수정체 → 각막 → 망막 → 유리체 → 시각 신경 → 뇌",
      "각막 → 수정체 → 유리체 → 망막 → 시각 신경 → 뇌",
      "각막 → 유리체 → 수정체 → 망막 → 시각 신경 → 뇌",
      "망막 → 각막 → 수정체 → 유리체 → 시각 신경 → 뇌",
    ],
    answerIndex: 1,
    explanation:
      "빛은 각막과 수정체를 지나며 굴절되고, 유리체를 통과해 망막에 상을 맺어요. 망막의 시각 세포가 받아들인 자극은 시각 신경을 따라 뇌로 전달돼요.",
  },
  {
    id: "std_bio_sense_a_lo_e1_q04",
    difficulty: "hard",
    stem: "망막의 황반과 맹점에 대한 설명으로 옳은 것은?",
    choices: [
      "황반에 상이 맺히면 물체가 보이지 않는다.",
      "맹점은 시각 세포가 없어서 상이 맺혀도 보이지 않는다.",
      "맹점에는 시각 세포가 가장 빽빽하게 모여 있다.",
      "황반은 시각 신경이 모여 눈 밖으로 나가는 부분이다.",
    ],
    answerIndex: 1,
    explanation:
      "맹점은 시각 신경이 모여 눈 밖으로 나가는 자리라서 시각 세포가 없어요. 그래서 여기에 상이 맺히면 물체가 보이지 않아요. 반대로 시각 세포가 많이 모인 황반에 상이 맺히면 가장 선명하게 보여요.",
  },
  {
    id: "std_bio_sense_a_lo_e1_q05",
    difficulty: "synthesis",
    stem:
      "어떤 사람이 물체를 보았는데 물체의 모습이 흐릿하게 보였다. 물체를 보는 과정을 근거로 할 때, 원인으로 가장 적절하지 않은 것은?",
    choices: [
      "각막이 손상되어 빛이 제대로 굴절되지 않았다.",
      "수정체가 뿌옇게 흐려져 빛이 잘 통과하지 못했다.",
      "망막의 시각 세포가 손상되어 빛 자극을 잘 받아들이지 못했다.",
      "시각 신경이 눈에서 뇌로 자극을 전달하지 못했다면 상은 선명하게 보인다.",
    ],
    answerIndex: 3,
    explanation:
      "시각 신경은 망막이 받아들인 자극을 뇌로 전달하는 통로예요. 이 경로가 끊기면 뇌가 자극을 받지 못해 물체를 볼 수 없어요. 나머지 셋은 굴절·수용 단계가 망가진 경우라 실제로 흐리게 보이는 원인이 맞아요.",
  },
];

/* ============================================================
   레슨 2: 눈의 조절 작용 (5문제 · ㄱㄴㄷ 5지선다)
   boxItems = <보기> 상자에 들어가는 ㄱ/ㄴ/ㄷ 진술
   ============================================================ */
const EYE_ADJUSTMENT_QUESTIONS = [
  {
    id: "std_bio_sense_a_lo_e2_q01",
    difficulty: "easy",
    format: "gnd",
    stem:
      "밝은 낮에 실내에서 운동장으로 나갔을 때 눈에서 일어나는 변화로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "홍채가 확장된다.",
      "동공이 커진다.",
      "눈으로 들어오는 빛의 양이 감소한다.",
    ],
    choices: ["ㄱ", "ㄴ", "ㄱ, ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "주변이 밝아지면 홍채가 확장되고(ㄱ), 그 결과 가운데 구멍인 동공은 오히려 작아져요. 동공이 작아지므로 눈으로 들어오는 빛의 양이 줄어들어요(ㄷ). ㄴ은 어두울 때 일어나는 변화라 틀렸어요.",
  },
  {
    id: "std_bio_sense_a_lo_e2_q02",
    difficulty: "medium",
    format: "gnd",
    stem:
      "어두운 방에 들어갔을 때 눈에서 일어나는 변화로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "홍채가 수축한다.",
      "동공이 커진다.",
      "눈으로 들어오는 빛의 양이 증가한다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "어두우면 홍채가 수축하고(ㄱ), 홍채가 수축한 만큼 동공이 커져요(ㄴ). 동공이 커지면 눈으로 들어오는 빛의 양이 늘어나(ㄷ) 어두운 곳에서도 물체를 볼 수 있어요. 셋 다 옳은 설명이에요.",
  },
  {
    id: "std_bio_sense_a_lo_e2_q03",
    difficulty: "medium",
    format: "gnd",
    stem:
      "책상 위의 책을 가까이에서 읽을 때 눈에서 일어나는 변화로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "수정체가 두꺼워진다.",
      "빛이 굴절되는 정도가 커진다.",
      "망막이 뒤쪽으로 움직여 상을 맺는다.",
    ],
    choices: ["ㄱ", "ㄴ", "ㄱ, ㄴ", "ㄱ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "가까운 물체를 볼 때는 수정체가 두꺼워져요(ㄱ). 두꺼워진 수정체는 빛을 더 크게 굴절시켜(ㄴ) 망막에 상이 맺히게 해요. 망막은 눈 안쪽 벽에 붙어 있어 앞뒤로 움직이지 않으므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_sense_a_lo_e2_q04",
    difficulty: "hard",
    format: "gnd",
    stem:
      "눈의 조절 작용에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "주변이 어두워지면 홍채가 확장되어 동공이 커진다.",
      "눈으로 들어오는 빛의 양은 동공의 크기가 변하여 조절된다.",
      "물체와의 거리에 따른 조절은 수정체의 두께가 변하여 이루어진다.",
    ],
    choices: ["ㄱ", "ㄴ", "ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 3,
    explanation:
      "빛의 양은 홍채가 움직여 동공 크기를 바꾸며 조절하고(ㄴ), 거리는 수정체 두께로 조절해요(ㄷ). ㄱ은 어두울 때 홍채가 '수축'해야 동공이 커지므로 틀렸어요. 홍채와 동공은 항상 반대로 움직인다는 점이 핵심이에요.",
  },
  {
    id: "std_bio_sense_a_lo_e2_q05",
    difficulty: "synthesis",
    format: "gnd",
    stem:
      "어두운 영화관에서 영화를 보다가 밖으로 나와, 바로 손에 든 가까운 안내판을 읽었다. 이때 눈에서 일어나는 변화로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "홍채가 확장되어 동공이 작아진다.",
      "수정체가 두꺼워진다.",
      "눈으로 들어오는 빛의 양이 증가한다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "밖이 더 밝으므로 홍채가 확장되고 동공이 작아져요(ㄱ). 이어서 가까운 안내판을 보려면 수정체가 두꺼워져야 해요(ㄴ). 동공이 작아졌으니 들어오는 빛의 양은 줄어들어 ㄷ은 틀렸어요. 빛의 양은 홍채·동공이, 거리는 수정체가 담당해요.",
  },
];

const EYE_QUESTIONS = [...EYE_STRUCTURE_QUESTIONS, ...EYE_ADJUSTMENT_QUESTIONS];

/* ============================================================
   생명과학 — 감각 기관(귀, 피부)
   그림 4-5 / 그림 4-6 기반. 도해는 직접 작도한 SVG.
   ============================================================ */
const EAR_DIAGRAM_SVG = `
<svg viewBox="0 0 420 250" width="100%" style="max-width:340px">
  <path d="M62 42 C 24 46, 18 130, 50 166 C 60 178, 76 180, 84 168 C 90 158, 84 146, 88 138"
        fill="#FFE6DC" stroke="#E08A6A" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M66 62 C 44 70, 42 124, 62 148" fill="none" stroke="#E08A6A" stroke-width="2"/>
  <path d="M86 112 L182 112 L182 152 L86 152 Z" fill="#FDF0E8" stroke="#E08A6A" stroke-width="2"/>
  <line x1="182" y1="104" x2="182" y2="160" stroke="#6C5CE7" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="203" cy="118" rx="11" ry="8" fill="#F5D77E" stroke="#C8992A" stroke-width="2"/>
  <ellipse cx="226" cy="106" rx="10" ry="7" fill="#F5D77E" stroke="#C8992A" stroke-width="2"/>
  <ellipse cx="248" cy="118" rx="10" ry="7" fill="#F5D77E" stroke="#C8992A" stroke-width="2"/>
  <path d="M323.0 150.0 L 323.6 149.1 L 323.9 148.0 L 324.1 146.8 L 324.0 145.5 L 323.7 144.2 L 323.0 142.8 L 322.1 141.6 L 320.9 140.4 L 319.4 139.5 L 317.7 138.8 L 315.8 138.3 L 313.7 138.3 L 311.6 138.6 L 309.5 139.2 L 307.4 140.3 L 305.5 141.8 L 303.8 143.6 L 302.3 145.8 L 301.2 148.3 L 300.5 151.0 L 300.3 153.9 L 300.6 156.9 L 301.4 159.9 L 302.7 162.8 L 304.5 165.6 L 306.9 168.1 L 309.6 170.2 L 312.8 171.9 L 316.3 173.0 L 320.1 173.6 L 324.0 173.6 L 327.9 172.9 L 331.8 171.6 L 335.4 169.6 L 338.8 166.9 L 341.8 163.7 L 344.3 160.0 L 346.1 155.8 L 347.3 151.3 L 347.8 146.5 L 347.4 141.6 L 346.3 136.8 L 344.3 132.1 L 341.6 127.7 L 338.1 123.7 L 334.0 120.3 L 329.3 117.6 L 324.1 115.6 L 318.5 114.4 L 312.7 114.2 L 306.9 114.9 L 301.2 116.5 L 295.7 119.1 L 290.6 122.7 L 286.1 127.0 L 282.3 132.1 L 279.3 137.8 L 277.2 144.1 L 276.2 150.6 L 276.2 157.4 L 277.3 164.2 L 279.6 170.8 L 282.9 177.0 L 287.2 182.7 L 292.4 187.7 L 298.5 191.9 L 305.3 195.0 L 312.5 197.1 L 320.1 198.0 L 327.9 197.7 L 335.6 196.1 L 343.0 193.2 L 350.0 189.2 L 356.3 184.0 L 361.7 177.8 L 366.2 170.7 L 369.4 162.9 L 371.5 154.6 L 372.1 146.0 L 371.4 137.3 L 369.3 128.7 L 365.8 120.5 L 360.9 112.8 L 354.9 106.0 L 347.7 100.1 L 339.6 95.5 L 330.8 92.1 L 321.4 90.2 L 311.8 89.8 L 302.1 90.9" fill="none" stroke="#E8B33C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M372 168 L406 190 L406 212 L368 190 Z" fill="#FFE7A8" stroke="#E0B93A" stroke-width="2"/>
  <circle cx="52" cy="104" r="5" fill="#1F2030"/>
  <text x="20" y="82" font-size="17" font-weight="700" fill="#1F2030">A</text>
  <line x1="28" y1="88" x2="48" y2="100" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="182" cy="132" r="5" fill="#1F2030"/>
  <text x="160" y="200" font-size="17" font-weight="700" fill="#1F2030">B</text>
  <line x1="168" y1="192" x2="180" y2="140" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="226" cy="106" r="4.5" fill="#1F2030"/>
  <text x="222" y="52" font-size="17" font-weight="700" fill="#1F2030">C</text>
  <line x1="228" y1="58" x2="228" y2="96" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="318" cy="150" r="5" fill="#1F2030"/>
  <text x="330" y="232" font-size="17" font-weight="700" fill="#1F2030">D</text>
  <line x1="332" y1="224" x2="322" y2="158" stroke="#1F2030" stroke-width="1.5"/>
</svg>`;

const EAR_QUESTIONS = [
  {
    "id": "std_bio_sense_a_lo_h1_q01",
    "difficulty": "easy",
    "stem": "우리가 귀에서 받아들이는 자극과, 그 자극으로 느끼는 감각을 바르게 짝지은 것은?",
    "choices": [
      "빛 — 청각",
      "소리 — 청각",
      "소리 — 시각",
      "압력 — 청각"
    ],
    "answerIndex": 1,
    "explanation": "소리는 물체의 진동으로 발생하며, 귀는 이 소리를 자극으로 받아들여 청각을 느낀다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q02",
    "difficulty": "medium",
    "svg": EAR_DIAGRAM_SVG,
    "stem": "그림은 귀의 구조를 나타낸 것이다. 고막의 진동을 증폭하여 달팽이관으로 전달하는 것은?",
    "choices": [
      "A (귓바퀴)",
      "B (고막)",
      "C (귓속뼈)",
      "D (달팽이관)"
    ],
    "answerIndex": 2,
    "explanation": "고막의 진동은 귓속뼈를 지나면서 증폭되어 달팽이관으로 전달된다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q03",
    "difficulty": "medium",
    "stem": "소리가 귀로 들어와 뇌까지 전달되는 순서로 옳은 것은?",
    "choices": [
      "귓바퀴 → 외이도 → 귓속뼈 → 고막 → 달팽이관 → 청각 신경 → 뇌",
      "귓바퀴 → 외이도 → 고막 → 귓속뼈 → 달팽이관 → 청각 신경 → 뇌",
      "외이도 → 귓바퀴 → 고막 → 달팽이관 → 귓속뼈 → 청각 신경 → 뇌",
      "고막 → 귓바퀴 → 외이도 → 귓속뼈 → 달팽이관 → 청각 신경 → 뇌"
    ],
    "answerIndex": 1,
    "explanation": "소리는 귓바퀴에서 모여 외이도를 지나 고막에 도달해 고막을 진동시키고, 그 진동이 귓속뼈에서 증폭되어 달팽이관으로 전달된다. 달팽이관의 청각 세포가 받아들인 자극은 청각 신경을 통해 뇌로 간다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q04",
    "difficulty": "hard",
    "stem": "귀의 구조와 그 기능을 바르게 짝지은 것은?",
    "choices": [
      "귓바퀴 — 진동을 증폭한다.",
      "달팽이관 — 소리를 모아 준다.",
      "고막 — 소리에 의해 진동한다.",
      "귓속뼈 — 청각 세포가 분포한다."
    ],
    "answerIndex": 2,
    "explanation": "고막은 도달한 소리에 의해 진동하는 얇은 막이다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q05",
    "difficulty": "synthesis",
    "stem": "사고로 귓속뼈가 제 기능을 하지 못하게 되었다. 이때 나타날 수 있는 결과로 가장 적절한 것은?",
    "choices": [
      "고막이 아예 진동하지 않는다.",
      "달팽이관의 청각 세포가 없어진다.",
      "소리가 귓바퀴에 모이지 않는다.",
      "고막은 진동하지만 그 진동이 충분히 증폭되지 않아 소리를 잘 듣지 못한다."
    ],
    "answerIndex": 3,
    "explanation": "귓속뼈는 고막의 진동을 증폭하는 역할만 한다. 따라서 고막의 진동 자체는 일어나지만 증폭이 되지 않아 달팽이관에 약한 진동만 전달되고, 소리를 잘 듣지 못하게 된다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q06",
    "difficulty": "easy",
    "format": "gnd",
    "stem": "소리를 듣는 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "소리는 물체의 진동으로 발생한다.",
      "고막은 소리에 의해 진동한다.",
      "귓바퀴는 소리를 모아 준다."
    ],
    "choices": [
      "ㄱ",
      "ㄷ",
      "ㄱ, ㄴ",
      "ㄴ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 4,
    "explanation": "ㄱ, ㄴ, ㄷ 모두 옳다. 소리는 물체의 진동에서 시작되고, 귓바퀴가 그 소리를 모아 외이도로 보내면 고막이 진동한다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q07",
    "difficulty": "medium",
    "format": "gnd",
    "stem": "귀의 각 부분에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "청각 세포는 달팽이관에 분포한다.",
      "귓속뼈는 고막의 진동을 증폭한다.",
      "청각 신경은 뇌의 자극을 귀로 전달한다."
    ],
    "choices": [
      "ㄱ",
      "ㄴ",
      "ㄱ, ㄴ",
      "ㄱ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 2,
    "explanation": "청각 세포는 달팽이관에 있고(ㄱ), 귓속뼈는 고막의 진동을 증폭한다(ㄴ). ㄷ은 방향이 반대로, 청각 신경은 귀가 받아들인 자극을 뇌로 전달한다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q08",
    "difficulty": "medium",
    "format": "gnd",
    "stem": "소리의 전달 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "고막의 진동은 달팽이관에서 증폭된다.",
      "청각 세포는 고막에 분포한다.",
      "소리는 외이도를 지나 고막에 도달한다."
    ],
    "choices": [
      "ㄱ",
      "ㄷ",
      "ㄱ, ㄴ",
      "ㄴ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 1,
    "explanation": "ㄷ만 옳다. 소리는 귓바퀴에서 모여 외이도를 지나 고막에 도달한다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q09",
    "difficulty": "hard",
    "format": "gnd",
    "stem": "귀에서 소리가 전달되는 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "귓바퀴에서 모인 소리는 외이도를 지난다.",
      "귓속뼈를 지나면서 진동이 증폭된다.",
      "달팽이관에서 받아들인 자극은 시각 신경을 통해 뇌로 전달된다."
    ],
    "choices": [
      "ㄱ",
      "ㄷ",
      "ㄱ, ㄴ",
      "ㄴ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 2,
    "explanation": "ㄱ, ㄴ이 옳다. ㄷ은 신경의 종류가 틀렸다. 달팽이관의 자극은 시각 신경이 아니라 청각 신경을 통해 뇌로 전달된다."
  },
  {
    "id": "std_bio_sense_a_lo_h1_q10",
    "difficulty": "synthesis",
    "format": "gnd",
    "stem": "눈과 귀를 비교한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "눈은 빛을, 귀는 소리를 자극으로 받아들인다.",
      "두 기관 모두 받아들인 자극을 신경을 통해 뇌로 전달한다.",
      "눈과 귀는 같은 신경을 이용해 자극을 뇌로 전달한다."
    ],
    "choices": [
      "ㄱ",
      "ㄴ",
      "ㄷ",
      "ㄱ, ㄴ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 3,
    "explanation": "ㄱ, ㄴ이 옳다. 감각 기관마다 받아들이는 자극이 다르지만, 받아들인 자극을 신경을 통해 뇌로 보내 감각을 느끼는 구조는 같다. ㄷ은 눈이 시각 신경, 귀가 청각 신경을 쓰므로 틀렸다."
  }
];

const SKIN_DIAGRAM_SVG = `
<svg viewBox="0 0 400 250" width="100%" style="max-width:330px">
  <rect x="30" y="28" width="310" height="60" fill="#FDE3C8" stroke="#D89B62" stroke-width="2"/>
  <rect x="30" y="88" width="310" height="102" fill="#F8C6A8" stroke="#D89B62" stroke-width="2"/>
  <text x="348" y="62" font-size="13" font-weight="700" fill="#6E6E85">표피</text>
  <text x="348" y="142" font-size="13" font-weight="700" fill="#6E6E85">진피</text>
  <ellipse cx="70" cy="110" rx="14" ry="11" fill="#FFF3B0" stroke="#C8992A" stroke-width="2"/>
  <ellipse cx="130" cy="124" rx="14" ry="11" fill="#FFD9E0" stroke="#D2637A" stroke-width="2"/>
  <g stroke="#C8992A" stroke-width="2" fill="none">
    <path d="M190 98 L190 130 M190 104 L179 93 M190 104 L201 93 M190 113 L177 106 M190 113 L203 106"/>
  </g>
  <ellipse cx="250" cy="112" rx="14" ry="11" fill="#FFE2B8" stroke="#C8862A" stroke-width="2"/>
  <ellipse cx="308" cy="122" rx="14" ry="11" fill="#D8ECFB" stroke="#4A8FC4" stroke-width="2"/>
  <path d="M42 172 L336 172" stroke="#E8B33C" stroke-width="6" stroke-linecap="round"/>
  <path d="M70 121 L70 172 M130 135 L130 172 M190 130 L190 172 M250 123 L250 172 M308 133 L308 172"
        stroke="#E8B33C" stroke-width="3"/>
  <circle cx="216" cy="172" r="5" fill="#1F2030"/>
  <text x="208" y="220" font-size="17" font-weight="700" fill="#1F2030">A</text>
  <line x1="216" y1="212" x2="216" y2="180" stroke="#1F2030" stroke-width="1.5"/>
</svg>`;

const SKIN_QUESTIONS = [
  {
    "id": "std_bio_sense_a_lo_s1_q01",
    "difficulty": "easy",
    "stem": "피부에서 자극을 받아들이는 부분을 무엇이라고 하는가?",
    "choices": [
      "시각 세포",
      "감각점",
      "청각 세포",
      "달팽이관"
    ],
    "answerIndex": 1,
    "explanation": "피부에는 냉점, 온점, 촉점, 압점, 통점의 감각점이 분포하며, 이곳에서 자극을 받아들인다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q02",
    "difficulty": "easy",
    "stem": "얼음을 만졌을 때 차가움을 느끼게 하는 감각점은?",
    "choices": [
      "온점",
      "통점",
      "냉점",
      "압점"
    ],
    "answerIndex": 2,
    "explanation": "냉점은 차가움을 느끼는 감각점이다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q03",
    "difficulty": "medium",
    "stem": "감각점과 그 감각점에서 느끼는 감각을 바르게 짝지은 것은?",
    "choices": [
      "온점 — 눌림",
      "통점 — 따뜻함",
      "압점 — 통증",
      "촉점 — 촉감"
    ],
    "answerIndex": 3,
    "explanation": "촉점은 무엇인가 닿는 느낌, 즉 촉감을 받아들이는 감각점이다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q04",
    "difficulty": "medium",
    "svg": SKIN_DIAGRAM_SVG,
    "stem": "그림은 피부의 구조를 나타낸 것이다. 감각점에서 받아들인 자극을 뇌로 전달하는 A는?",
    "choices": [
      "시각 신경",
      "청각 신경",
      "감각 신경",
      "감각점"
    ],
    "answerIndex": 2,
    "explanation": "감각점에서 받아들인 자극은 감각 신경을 통해 뇌로 전달되어 피부 자극을 느끼게 된다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q05",
    "difficulty": "synthesis",
    "stem": "뜨거운 컵을 손으로 잡았을 때, 뜨거움을 느끼기까지의 과정으로 옳은 것은?",
    "choices": [
      "온점 → 감각 신경 → 뇌",
      "통점 → 청각 신경 → 뇌",
      "냉점 → 감각 신경 → 뇌",
      "온점 → 시각 신경 → 뇌"
    ],
    "answerIndex": 0,
    "explanation": "따뜻함이나 뜨거움은 온점이 받아들이며, 이 자극은 감각 신경을 통해 뇌로 전달되어 감각을 느끼게 된다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q06",
    "difficulty": "easy",
    "format": "gnd",
    "stem": "피부 감각에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "피부에는 냉점, 온점, 촉점, 압점, 통점의 감각점이 분포한다.",
      "감각점에서 받아들인 자극은 감각 신경을 통해 뇌로 전달된다.",
      "피부는 빛을 자극으로 받아들인다."
    ],
    "choices": [
      "ㄱ",
      "ㄴ",
      "ㄱ, ㄴ",
      "ㄱ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 2,
    "explanation": "ㄱ, ㄴ이 옳다. ㄷ의 빛은 눈이 받아들이는 자극이며, 피부는 열·접촉·압력 등을 받아들인다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q07",
    "difficulty": "medium",
    "format": "gnd",
    "stem": "감각점에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "통점은 통증을 느끼는 감각점이다.",
      "냉점은 따뜻함을 느끼는 감각점이다.",
      "압점은 눌리는 느낌을 받아들이는 감각점이다."
    ],
    "choices": [
      "ㄱ",
      "ㄴ",
      "ㄷ",
      "ㄱ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 3,
    "explanation": "ㄱ, ㄷ이 옳다. ㄴ의 냉점은 따뜻함이 아니라 차가움을 느끼는 감각점이다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q08",
    "difficulty": "medium",
    "format": "gnd",
    "stem": "피부가 자극을 받아들이는 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "감각점은 종류에 관계없이 모두 같은 자극을 받아들인다.",
      "피부는 열, 접촉, 압력 등을 자극으로 받아들인다.",
      "감각점에서 받아들인 자극은 감각 신경을 거쳐 뇌로 전달된다."
    ],
    "choices": [
      "ㄱ",
      "ㄴ",
      "ㄱ, ㄴ",
      "ㄴ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 3,
    "explanation": "ㄴ, ㄷ이 옳다. ㄱ은 틀렸다. 감각점은 종류마다 받아들이는 자극이 달라서 냉점은 차가움, 온점은 따뜻함, 통점은 통증을 받아들인다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q09",
    "difficulty": "hard",
    "format": "gnd",
    "stem": "다음 상황에서 주로 자극되는 감각점을 옳게 설명한 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "얼음을 손에 쥐었을 때는 주로 냉점이 자극된다.",
      "손가락으로 책상을 세게 눌렀을 때는 압점이 자극된다.",
      "바늘에 손끝이 찔렸을 때는 온점이 자극된다."
    ],
    "choices": [
      "ㄱ",
      "ㄷ",
      "ㄱ, ㄴ",
      "ㄴ, ㄷ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 2,
    "explanation": "ㄱ, ㄴ이 옳다. ㄷ은 틀렸다. 바늘에 찔렸을 때 느끼는 통증은 온점이 아니라 통점이 받아들인다."
  },
  {
    "id": "std_bio_sense_a_lo_s1_q10",
    "difficulty": "synthesis",
    "format": "gnd",
    "stem": "눈, 귀, 피부를 비교한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    "boxItems": [
      "눈은 빛을, 귀는 소리를, 피부는 열·접촉·압력 등을 자극으로 받아들인다.",
      "세 기관 모두 받아들인 자극을 신경을 통해 뇌로 전달한다.",
      "자극을 실제로 느끼는 곳은 뇌가 아니라 각 감각 기관이다."
    ],
    "choices": [
      "ㄱ",
      "ㄴ",
      "ㄷ",
      "ㄱ, ㄴ",
      "ㄱ, ㄴ, ㄷ"
    ],
    "answerIndex": 3,
    "explanation": "ㄱ, ㄴ이 옳다. ㄷ은 틀렸다. 감각 기관은 자극을 받아들이는 곳이고, 그 자극을 실제로 느끼는 곳은 뇌다."
  }
];

/* ============================================================
   생명과학 — 미각 · 후각 (혀 · 코) 10문제
   교과서 본문 + 그림 4-7 기반
   ============================================================ */
const TASTE_SMELL_QUESTIONS = [
  {
    id: "std_bio_sense_a_lo_t1_q01",
    difficulty: "easy",
    stem: "미각과 후각이 자극으로 받아들이는 물질의 상태를 바르게 짝지은 것은?",
    choices: [
      "미각 — 기체 물질, 후각 — 액체 물질",
      "미각 — 액체 물질, 후각 — 기체 물질",
      "미각과 후각 모두 액체 물질",
      "미각과 후각 모두 기체 물질",
    ],
    answerIndex: 1,
    explanation:
      "혀는 입속으로 들어온 액체 물질을 자극으로 받아들여 맛을 느끼고, 코는 콧속으로 들어온 기체 물질을 자극으로 받아들여 냄새를 맡아요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q02",
    difficulty: "easy",
    stem: "혀에서 미각으로 느끼는 기본적인 맛에 해당하지 않는 것은?",
    choices: ["감칠맛", "매운맛", "신맛", "쓴맛"],
    answerIndex: 1,
    explanation:
      "미각으로 느끼는 기본적인 맛은 단맛, 신맛, 짠맛, 쓴맛, 감칠맛의 다섯 가지예요. 매운맛은 여기에 들어가지 않아요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q03",
    difficulty: "medium",
    stem: "맛세포가 모여 있는 구조와 그 위치를 바르게 짝지은 것은?",
    choices: [
      "후각 상피 — 콧속 윗부분",
      "맛봉오리 — 콧속 윗부분",
      "맛봉오리 — 혀 표면 돌기의 옆면",
      "후각 상피 — 혀 표면 돌기의 옆면",
    ],
    answerIndex: 2,
    explanation:
      "혀 표면 돌기의 옆면에는 맛봉오리가 여러 개 있고, 그 맛봉오리 안에 맛세포가 모여 있어요. 후각 상피는 콧속 윗부분에 있으며 냄새를 담당해요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q04",
    difficulty: "medium",
    stem: "후각 세포가 분포하는 곳으로 옳은 것은?",
    choices: [
      "혀의 맛봉오리",
      "콧속 윗부분의 후각 상피",
      "피부의 진피",
      "달팽이관",
    ],
    answerIndex: 1,
    explanation:
      "콧속 윗부분은 후각 세포가 있는 후각 상피로 덮여 있어요. 콧속으로 들어온 기체 물질이 이 후각 세포를 자극하면 냄새를 맡게 돼요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q05",
    difficulty: "medium",
    stem: "국을 한 숟가락 먹었을 때 맛을 느끼기까지의 과정으로 옳은 것은?",
    choices: [
      "액체 물질 → 후각 세포 → 후각 신경 → 뇌",
      "기체 물질 → 맛세포 → 미각 신경 → 뇌",
      "액체 물질 → 맛세포 → 미각 신경 → 뇌",
      "액체 물질 → 맛세포 → 뇌 → 미각 신경",
    ],
    answerIndex: 2,
    explanation:
      "입속으로 들어온 액체 물질이 맛봉오리 속 맛세포를 자극하면, 그 자극이 미각 신경을 통해 뇌로 전달되어 맛을 느끼게 돼요. 신경은 뇌로 가는 통로이므로 뇌가 마지막이에요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q06",
    difficulty: "medium",
    format: "gnd",
    stem: "미각이 느껴지는 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "혀 표면 돌기의 옆면에 맛봉오리가 있다.",
      "맛봉오리에는 맛세포가 모여 있다.",
      "맛세포가 받아들인 자극은 후각 신경을 통해 뇌로 전달된다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "혀 표면 돌기 옆면에 맛봉오리가 있고(ㄱ), 그 안에 맛세포가 모여 있어요(ㄴ). 맛세포의 자극은 후각 신경이 아니라 미각 신경을 통해 뇌로 전달되므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q07",
    difficulty: "hard",
    stem: "빵 굽는 냄새를 맡게 되는 과정으로 옳은 것은?",
    choices: [
      "기체 물질이 후각 상피의 후각 세포를 자극 → 후각 신경 → 뇌",
      "액체 물질이 후각 세포를 자극 → 미각 신경 → 뇌",
      "기체 물질이 맛세포를 자극 → 후각 신경 → 뇌",
      "기체 물질이 후각 세포를 자극 → 미각 신경 → 뇌",
    ],
    answerIndex: 0,
    explanation:
      "냄새는 콧속으로 들어온 기체 물질이 후각 상피의 후각 세포를 자극하고, 그 자극이 후각 신경을 통해 뇌로 전달되어 느껴져요. 자극 물질(기체), 받아들이는 세포(후각 세포), 전달 신경(후각 신경)이 모두 맞아야 해요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q08",
    difficulty: "hard",
    format: "gnd",
    stem: "미각과 후각을 비교한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "맛세포가 받아들인 자극은 미각 신경을 통해 뇌로 전달된다.",
      "후각 세포가 받아들인 자극은 후각 신경을 통해 뇌로 전달된다.",
      "미각과 후각은 서로 다른 신경을 통해 뇌로 전달된다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "맛세포의 자극은 미각 신경으로(ㄱ), 후각 세포의 자극은 후각 신경으로 전달돼요(ㄴ). 둘은 서로 다른 신경이므로 ㄷ도 옳아요. 셋 다 맞는 설명이에요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q09",
    difficulty: "synthesis",
    stem: "감각 기관과 그 기관이 받아들이는 자극을 바르게 짝지은 것은?",
    choices: [
      "눈 — 소리",
      "귀 — 기체 물질",
      "혀 — 빛",
      "코 — 기체 물질",
    ],
    answerIndex: 3,
    explanation:
      "코는 기체 물질을 자극으로 받아들여 냄새를 맡아요. 눈은 빛, 귀는 소리, 혀는 액체 물질을 받아들이므로 나머지는 모두 잘못 짝지어졌어요.",
  },
  {
    id: "std_bio_sense_a_lo_t1_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "눈, 귀, 코, 혀, 피부에서 자극을 느끼는 과정의 공통점으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "정해진 자극을 받아들이는 감각 세포나 감각점이 있다.",
      "받아들인 자극은 신경을 통해 뇌로 전달된다.",
      "자극을 실제로 인식하는 곳은 감각 기관 자체이다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "감각 기관마다 정해진 자극을 받아들이는 세포나 감각점이 있고(ㄱ), 그 자극은 신경을 통해 뇌로 전달돼요(ㄴ). 하지만 자극을 실제로 인식하는 곳은 감각 기관이 아니라 뇌이므로 ㄷ은 틀렸어요.",
  },
];

/* 생명과학 4단원 — 신경계 (신경계 구성 · 뉴런 · 반사) */

/* ============================================================
   중추 신경계 구조 다이어그램 (문제용 · 직접 그린 모식도)
   A 대뇌 / B 간뇌 / C 중간뇌 / D 소뇌 / E 연수
   ============================================================ */
const BRAIN_DIAGRAM_SVG = `
<svg viewBox="0 0 380 300" width="100%" style="max-width:330px">
  <ellipse cx="152" cy="118" rx="112" ry="80" fill="#FBEDE2" stroke="#C08A63" stroke-width="2.5"/>
  <path d="M62 96 Q98 78 132 96" fill="none" stroke="#C08A63" stroke-width="1.8" opacity=".7"/>
  <path d="M74 128 Q112 110 150 130" fill="none" stroke="#C08A63" stroke-width="1.8" opacity=".7"/>
  <path d="M96 62 Q136 52 172 70" fill="none" stroke="#C08A63" stroke-width="1.8" opacity=".7"/>
  <path d="M186 92 Q214 80 238 100" fill="none" stroke="#C08A63" stroke-width="1.8" opacity=".7"/>
  <ellipse cx="176" cy="150" rx="27" ry="16" fill="#F6D8BC" stroke="#B87A4E" stroke-width="2.2"/>
  <ellipse cx="198" cy="180" rx="16" ry="13" fill="#EFC49F" stroke="#B87A4E" stroke-width="2.2"/>
  <ellipse cx="284" cy="180" rx="46" ry="34" fill="#F2CFAC" stroke="#B87A4E" stroke-width="2.5"/>
  <path d="M246 168 H320 M244 180 H322 M248 192 H318" stroke="#B87A4E" stroke-width="1.6" opacity=".75"/>
  <path d="M186 194 Q196 216 200 238 L226 238 Q222 214 214 194 Z" fill="#F6D8BC" stroke="#B87A4E" stroke-width="2.2"/>
  <path d="M200 238 L226 238 L228 292 L202 292 Z" fill="#FDF0D8" stroke="#B87A4E" stroke-width="2.2"/>
  <circle cx="96" cy="104" r="5" fill="#1F2030"/>
  <text x="24" y="60" font-size="17" font-weight="700" fill="#1F2030">A</text>
  <line x1="34" y1="66" x2="92" y2="99" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="176" cy="150" r="4.5" fill="#1F2030"/>
  <text x="132" y="232" font-size="17" font-weight="700" fill="#1F2030">B</text>
  <line x1="142" y1="225" x2="171" y2="158" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="198" cy="180" r="4.5" fill="#1F2030"/>
  <text x="150" y="272" font-size="17" font-weight="700" fill="#1F2030">C</text>
  <line x1="160" y1="266" x2="193" y2="190" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="284" cy="180" r="4.5" fill="#1F2030"/>
  <text x="348" y="132" font-size="17" font-weight="700" fill="#1F2030">D</text>
  <line x1="348" y1="138" x2="298" y2="168" stroke="#1F2030" stroke-width="1.5"/>
  <circle cx="208" cy="218" r="4.5" fill="#1F2030"/>
  <text x="290" y="252" font-size="17" font-weight="700" fill="#1F2030">E</text>
  <line x1="288" y1="248" x2="216" y2="222" stroke="#1F2030" stroke-width="1.5"/>
</svg>`;

/* ============================================================
   생명과학 — 신경계의 구성과 중추 신경계 10문제
   ============================================================ */
const NERVOUS_SYSTEM_QUESTIONS = [
  {
    id: "std_bio_nerve_a_q01",
    difficulty: "easy",
    stem: "우리 몸의 신경계는 크게 어떻게 구분되는가?",
    choices: [
      "감각 신경계와 운동 신경계",
      "중추 신경계와 말초 신경계",
      "뇌 신경계와 근육 신경계",
      "대뇌 신경계와 척수 신경계",
    ],
    answerIndex: 1,
    explanation:
      "신경계는 중추 신경계와 말초 신경계로 구분돼요. 감각 신경과 운동 신경은 말초 신경계를 이루는 부분이지, 신경계 전체를 나누는 기준이 아니에요.",
  },
  {
    id: "std_bio_nerve_a_q02",
    difficulty: "easy",
    stem: "중추 신경계를 이루는 기관을 바르게 짝지은 것은?",
    choices: [
      "감각 신경과 운동 신경",
      "뇌와 근육",
      "뇌와 척수",
      "척수와 감각 신경",
    ],
    answerIndex: 2,
    explanation:
      "중추 신경계는 뇌와 척수로 이루어져 있어요. 자극을 느끼고 판단하여 적절한 신호를 보내는 일을 담당해요.",
  },
  {
    id: "std_bio_nerve_a_q03",
    difficulty: "medium",
    stem: "말초 신경계에 대한 설명으로 옳은 것은?",
    choices: [
      "뇌와 척수로 이루어져 자극을 판단한다.",
      "감각 신경과 운동 신경으로 이루어져 중추 신경계와 온몸을 연결한다.",
      "대뇌와 소뇌로 이루어져 몸의 균형을 유지한다.",
      "근육으로만 이루어져 반응을 일으킨다.",
    ],
    answerIndex: 1,
    explanation:
      "말초 신경계는 감각 신경과 운동 신경으로 이루어져 있고, 온몸에 퍼져 중추 신경계와 몸을 연결해요. 자극을 느끼고 판단하는 일은 중추 신경계가 해요.",
  },
  {
    id: "std_bio_nerve_a_q04",
    difficulty: "medium",
    stem: "감각 신경과 운동 신경이 자극이나 신호를 전달하는 방향을 바르게 짝지은 것은?",
    choices: [
      "감각 신경: 중추 신경계 → 감각 기관 / 운동 신경: 반응 기관 → 중추 신경계",
      "감각 신경: 감각 기관 → 중추 신경계 / 운동 신경: 중추 신경계 → 반응 기관",
      "둘 다 감각 기관에서 중추 신경계로 전달한다.",
      "둘 다 중추 신경계에서 반응 기관으로 전달한다.",
    ],
    answerIndex: 1,
    explanation:
      "감각 신경은 감각 기관에서 받아들인 자극을 중추 신경계로 '들여보내고', 운동 신경은 중추 신경계가 보낸 신호를 근육 같은 반응 기관으로 '내보내요'. 방향이 서로 반대예요.",
  },
  {
    id: "std_bio_nerve_a_q05",
    difficulty: "medium",
    svg: BRAIN_DIAGRAM_SVG,
    stem: "그림은 중추 신경계의 구조를 나타낸 것이다. 심장 박동과 호흡 운동 등 생명 유지 활동을 조절하는 곳은?",
    choices: ["A (대뇌)", "B (간뇌)", "C (중간뇌)", "D (소뇌)", "E (연수)"],
    answerIndex: 4,
    explanation:
      "연수(E)는 심장 박동과 호흡 운동처럼 생명을 유지하는 데 꼭 필요한 활동을 조절해요. 그래서 연수가 손상되면 생명이 위험해질 수 있어요.",
  },
  {
    id: "std_bio_nerve_a_q06",
    difficulty: "medium",
    svg: BRAIN_DIAGRAM_SVG,
    stem: "그림에서 눈의 움직임과 동공·홍채의 변화를 조절하는 곳은?",
    choices: ["A (대뇌)", "B (간뇌)", "C (중간뇌)", "D (소뇌)", "E (연수)"],
    answerIndex: 2,
    explanation:
      "중간뇌(C)는 눈의 움직임과 동공·홍채의 변화를 조절해요. 앞에서 배운 밝기에 따른 동공 조절도 중간뇌가 담당하는 일이에요.",
  },
  {
    id: "std_bio_nerve_a_q07",
    difficulty: "hard",
    stem: "뇌의 각 부분과 그 기능을 짝지은 것으로 옳지 않은 것은?",
    choices: [
      "간뇌 — 체온을 비롯한 몸속 상태를 일정하게 유지한다.",
      "소뇌 — 근육 운동을 조절하여 몸의 균형을 유지한다.",
      "대뇌 — 기억, 추리, 감정 등의 정신 활동을 담당한다.",
      "소뇌 — 심장 박동과 호흡 운동을 조절한다.",
    ],
    answerIndex: 3,
    explanation:
      "심장 박동과 호흡 운동을 조절하는 곳은 소뇌가 아니라 연수예요. 소뇌는 근육 운동을 조절해 몸의 균형을 잡는 일을 해요. 둘 다 무의식적으로 일어나는 일이라 헷갈리기 쉬워요.",
  },
  {
    id: "std_bio_nerve_a_q08",
    difficulty: "medium",
    format: "gnd",
    stem: "대뇌에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "감각 기관에서 받아들인 자극을 느끼고 판단한다.",
      "기억, 추리, 감정 등 다양한 정신 활동을 담당한다.",
      "체온을 일정하게 유지하는 일을 담당한다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "대뇌는 자극을 느끼고 판단해 몸의 감각과 운동을 조절하며(ㄱ), 기억·추리·감정 같은 정신 활동도 담당해요(ㄴ). 체온을 비롯한 몸속 상태를 일정하게 유지하는 일은 간뇌가 하므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_nerve_a_q09",
    difficulty: "hard",
    stem: "척수의 기능에 대한 설명으로 옳은 것은?",
    choices: [
      "기억과 추리 같은 정신 활동을 담당한다.",
      "뇌와 말초 신경 사이에서 신호를 전달하는 통로 역할을 한다.",
      "몸의 균형을 유지하는 일만 담당한다.",
      "감각 기관에서 자극을 직접 받아들인다.",
    ],
    answerIndex: 1,
    explanation:
      "척수는 뇌와 말초 신경 사이에서 신호가 오가는 통로예요. 또한 자신의 의지와 관계없이 일어나는 반응을 조절하는 중추 역할도 해요. 자극을 직접 받아들이는 곳은 감각 기관이에요.",
  },
  {
    id: "std_bio_nerve_a_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "야구 경기에서 타자가 날아오는 공을 보고 방망이를 휘둘렀다. 이 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "눈에서 받아들인 자극은 감각 신경을 통해 중추 신경계로 전달된다.",
      "중추 신경계가 자극을 느끼고 판단하여 신호를 보낸다.",
      "중추 신경계가 보낸 신호는 감각 신경을 통해 팔의 근육으로 전달된다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "눈이 받아들인 자극은 감각 신경을 타고 중추 신경계로 가고(ㄱ), 중추 신경계가 판단해 신호를 보내요(ㄴ). 그런데 그 신호를 근육으로 전달하는 것은 감각 신경이 아니라 운동 신경이므로 ㄷ은 틀렸어요.",
  },
];

/* ============================================================
   생명과학 — 뉴런과 자극의 전달 10문제
   ============================================================ */
const NEURON_QUESTIONS = [
  {
    id: "std_bio_nerve_b_q01",
    difficulty: "easy",
    stem: "신경계를 이루는 신경 세포를 무엇이라고 하는가?",
    choices: ["뉴런", "감각점", "맛봉오리", "시각 세포"],
    answerIndex: 0,
    explanation:
      "신경계는 신경 세포인 뉴런으로 이루어져 있어요. 감각점, 맛봉오리, 시각 세포는 감각 기관에서 자극을 받아들이는 구조예요.",
  },
  {
    id: "std_bio_nerve_b_q02",
    difficulty: "easy",
    stem: "뉴런을 이루는 세 부분을 바르게 짝지은 것은?",
    choices: [
      "신경 세포체, 가지 돌기, 축삭 돌기",
      "신경 세포체, 맛봉오리, 축삭 돌기",
      "가지 돌기, 축삭 돌기, 감각점",
      "대뇌, 소뇌, 연수",
    ],
    answerIndex: 0,
    explanation:
      "뉴런은 신경 세포체, 가지 돌기, 축삭 돌기로 이루어져 있어요. 대뇌·소뇌·연수는 뇌를 이루는 부분이지 뉴런의 구조가 아니에요.",
  },
  {
    id: "std_bio_nerve_b_q03",
    difficulty: "medium",
    stem: "뉴런에서 다른 뉴런이나 감각 기관에서 전달된 자극을 받아들이는 부분은?",
    choices: ["축삭 돌기", "신경 세포체", "가지 돌기", "핵"],
    answerIndex: 2,
    explanation:
      "가지 돌기는 다른 뉴런이나 감각 기관에서 전달된 자극을 받아들이는 부분이에요. 축삭 돌기는 반대로 자극을 다른 뉴런이나 기관으로 내보내요.",
  },
  {
    id: "std_bio_nerve_b_q04",
    difficulty: "medium",
    stem: "뉴런의 각 부분과 기능을 짝지은 것으로 옳지 않은 것은?",
    choices: [
      "신경 세포체 — 핵과 세포질이 있어 여러 생명 활동이 일어난다.",
      "가지 돌기 — 전달된 자극을 받아들인다.",
      "축삭 돌기 — 다른 뉴런이나 기관으로 자극을 전달한다.",
      "축삭 돌기 — 자극을 느끼고 판단하는 일을 한다.",
    ],
    answerIndex: 3,
    explanation:
      "축삭 돌기는 자극을 전달하는 통로일 뿐, 자극을 느끼고 판단하지는 않아요. 자극을 느끼고 판단하는 일은 중추 신경계를 이루는 연합 뉴런이 담당해요.",
  },
  {
    id: "std_bio_nerve_b_q05",
    difficulty: "medium",
    stem: "뉴런의 종류와 그 뉴런이 이루는 것을 바르게 짝지은 것은?",
    choices: [
      "감각 뉴런 — 중추 신경계",
      "연합 뉴런 — 운동 신경",
      "운동 뉴런 — 감각 신경",
      "연합 뉴런 — 중추 신경계",
    ],
    answerIndex: 3,
    explanation:
      "감각 뉴런은 감각 신경을, 연합 뉴런은 중추 신경계를, 운동 뉴런은 운동 신경을 이뤄요. 연합 뉴런만 중추 신경계에 속한다는 점이 핵심이에요.",
  },
  {
    id: "std_bio_nerve_b_q06",
    difficulty: "medium",
    format: "gnd",
    stem: "연합 뉴런에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "중추 신경계를 이룬다.",
      "자극을 느끼고 판단한다.",
      "운동 뉴런에 적절한 반응 신호를 보낸다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "연합 뉴런은 중추 신경계를 이루며(ㄱ), 자극을 느끼고 판단하여(ㄴ) 운동 뉴런에 적절한 반응 신호를 보내요(ㄷ). 셋 다 옳은 설명이에요.",
  },
  {
    id: "std_bio_nerve_b_q07",
    difficulty: "hard",
    stem: "자극이 전달되어 반응이 일어나기까지의 순서로 옳은 것은?",
    choices: [
      "감각 기관 → 운동 뉴런 → 연합 뉴런 → 감각 뉴런 → 반응 기관",
      "감각 기관 → 연합 뉴런 → 감각 뉴런 → 운동 뉴런 → 반응 기관",
      "감각 기관 → 감각 뉴런 → 연합 뉴런 → 운동 뉴런 → 반응 기관",
      "반응 기관 → 감각 뉴런 → 연합 뉴런 → 운동 뉴런 → 감각 기관",
    ],
    answerIndex: 2,
    explanation:
      "감각 기관이 받아들인 자극은 감각 뉴런을 거쳐 연합 뉴런으로 가고, 연합 뉴런이 판단해 운동 뉴런으로 신호를 보내면 반응 기관에서 반응이 일어나요.",
  },
  {
    id: "std_bio_nerve_b_q08",
    difficulty: "hard",
    format: "gnd",
    stem: "휴대 전화에서 소리가 나자 팔을 뻗어 전화를 들어 올렸다. 이 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "귀에서 받아들인 자극은 감각 뉴런을 통해 연합 뉴런으로 전달된다.",
      "연합 뉴런이 자극을 판단하여 운동 뉴런에 신호를 보낸다.",
      "팔의 근육은 감각 기관에 해당한다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "귀가 받아들인 자극은 청각 신경을 이루는 감각 뉴런을 통해 연합 뉴런으로 가고(ㄱ), 연합 뉴런이 판단해 운동 뉴런에 신호를 보내요(ㄴ). 팔의 근육은 신호를 받아 반응하는 반응 기관이므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_nerve_b_q09",
    difficulty: "hard",
    stem: "감각 뉴런과 연합 뉴런은 정상이지만 운동 뉴런이 손상된 사람에게 나타날 수 있는 현상으로 가장 알맞은 것은?",
    choices: [
      "감각 기관이 자극을 전혀 받아들이지 못한다.",
      "자극을 느끼고 판단할 수 없다.",
      "자극을 느끼고 판단할 수는 있지만 근육에 신호가 전달되지 않아 반응이 일어나기 어렵다.",
      "자극이 감각 뉴런으로 전달되지 않는다.",
    ],
    answerIndex: 2,
    explanation:
      "운동 뉴런은 연합 뉴런이 보낸 신호를 반응 기관으로 전달하는 마지막 단계예요. 앞 단계인 자극 수용과 판단은 정상이지만, 신호가 근육까지 가지 못해 반응이 일어나기 어려워요.",
  },
  {
    id: "std_bio_nerve_b_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "뉴런과 신경계의 관계에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "감각 뉴런은 말초 신경계인 감각 신경을 이룬다.",
      "운동 뉴런은 말초 신경계인 운동 신경을 이룬다.",
      "연합 뉴런은 말초 신경계를 이룬다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "말초 신경계는 감각 신경과 운동 신경으로 이루어지므로, 감각 뉴런(ㄱ)과 운동 뉴런(ㄴ)은 말초 신경계를 이뤄요. 연합 뉴런은 중추 신경계를 이루므로 ㄷ은 틀렸어요.",
  },
];

/* 눈 관련 10문제를 한 레슨으로 합침 (구조 5 + 조절 작용 5) */

/* ============================================================
   생명과학 — 의식적 반응과 무조건 반사 10문제
   교과서 본문 + 그림 4-12 기반
   ============================================================ */
const REFLEX_QUESTIONS = [
  {
    id: "std_bio_nerve_c_q01",
    difficulty: "easy",
    stem: "대뇌의 판단 과정을 거쳐 자신의 의지에 따라 일어나는 반응을 무엇이라고 하는가?",
    choices: ["무조건 반사", "의식적 반응", "평형 감각", "미각"],
    answerIndex: 1,
    explanation:
      "대뇌가 자극을 느끼고 판단하는 과정을 거쳐, 자신의 의지에 따라 일어나는 반응을 의식적 반응이라고 해요.",
  },
  {
    id: "std_bio_nerve_c_q02",
    difficulty: "easy",
    stem: "다음 중 무조건 반사에 해당하는 것은?",
    choices: [
      "날아오는 공을 보고 야구 방망이를 휘두른다.",
      "친구가 부르는 소리를 듣고 손을 흔든다.",
      "공이 갑자기 눈앞으로 날아올 때 눈이 감긴다.",
      "칠판의 글씨를 보고 공책에 받아 적는다.",
    ],
    answerIndex: 2,
    explanation:
      "무조건 반사는 자신의 의지와 관계없이 일어나는 반응이에요. 눈앞으로 공이 날아올 때 저절로 눈이 감기는 것이 여기에 해당해요. 나머지는 모두 대뇌의 판단을 거쳐 의지에 따라 하는 의식적 반응이에요.",
  },
  {
    id: "std_bio_nerve_c_q03",
    difficulty: "medium",
    stem: "고무망치로 무릎뼈 아래를 쳤을 때 다리가 들리는 반응의 경로로 옳은 것은?",
    choices: [
      "자극 → 감각 신경 → 대뇌 → 운동 신경 → 다리 근육",
      "자극 → 감각 신경 → 척수 → 운동 신경 → 다리 근육",
      "자극 → 운동 신경 → 척수 → 감각 신경 → 다리 근육",
      "자극 → 감각 신경 → 척수 → 대뇌 → 운동 신경 → 다리 근육",
    ],
    answerIndex: 1,
    explanation:
      "무릎 반사는 자극이 감각 신경을 통해 척수로 전달된 다음, 척수에서 바로 운동 신경을 통해 다리 근육으로 신호가 가요. 대뇌를 거치지 않기 때문에 경로가 짧고 단순해요.",
  },
  {
    id: "std_bio_nerve_c_q04",
    difficulty: "medium",
    stem: "피부에 자극을 받고 의식적으로 팔을 드는 반응의 경로로 옳은 것은?",
    choices: [
      "자극 → 감각 신경 → 척수 → 운동 신경 → 팔 근육",
      "자극 → 감각 신경 → 대뇌 → 척수 → 팔 근육",
      "자극 → 감각 신경 → 척수 → 대뇌 → 운동 신경 → 팔 근육",
      "자극 → 대뇌 → 감각 신경 → 척수 → 팔 근육",
    ],
    answerIndex: 2,
    explanation:
      "의식적 반응은 자극이 감각 신경을 통해 피부에서 척수를 거쳐 대뇌로 전달되고, 대뇌가 느끼고 판단한 다음 운동 신경을 통해 팔 근육으로 신호를 보내요. 대뇌를 거치는 만큼 경로가 길어요.",
  },
  {
    id: "std_bio_nerve_c_q05",
    difficulty: "medium",
    stem: "무릎 반사가 의식적으로 팔을 드는 반응보다 더 빠르게 일어나는 까닭으로 가장 알맞은 것은?",
    choices: [
      "다리 근육이 팔 근육보다 크기 때문이다.",
      "반응이 일어나는 경로가 짧고 단순하기 때문이다.",
      "감각 신경이 운동 신경보다 빠르기 때문이다.",
      "척수가 대뇌보다 자극을 더 세게 받아들이기 때문이다.",
    ],
    answerIndex: 1,
    explanation:
      "무릎 반사는 대뇌의 판단 과정을 거치지 않고 척수에서 바로 운동 신경으로 신호를 보내요. 거쳐 가는 단계가 적어 경로가 짧고 단순하기 때문에 더 빠르게 일어나요.",
  },
  {
    id: "std_bio_nerve_c_q06",
    difficulty: "medium",
    format: "gnd",
    stem: "무조건 반사에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "대뇌의 판단 과정을 거치지 않는다.",
      "자신의 의지와 관계없이 일어난다.",
      "의식적 반응보다 느리게 일어난다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "무조건 반사는 대뇌의 판단을 거치지 않고(ㄱ), 자신의 의지와 관계없이 일어나요(ㄴ). 경로가 짧고 단순해서 의식적 반응보다 오히려 빠르게 일어나므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_nerve_c_q07",
    difficulty: "hard",
    stem: "의식적 반응과 무조건 반사를 비교한 설명으로 옳지 않은 것은?",
    choices: [
      "의식적 반응은 대뇌가 자극을 느끼고 판단하는 과정을 거친다.",
      "무조건 반사는 반응 중추가 대뇌가 아닌 곳에 있다.",
      "두 반응 모두 신경계를 통해 자극이 전달되어 일어난다.",
      "무조건 반사는 자극이 감각 신경을 거치지 않고 곧바로 근육에 전달된다.",
    ],
    answerIndex: 3,
    explanation:
      "무조건 반사도 자극은 반드시 감각 신경을 통해 척수 같은 중추로 전달돼요. 대뇌를 거치지 않을 뿐이지 감각 신경을 건너뛰는 것은 아니에요. 나머지 셋은 모두 옳은 설명이에요.",
  },
  {
    id: "std_bio_nerve_c_q08",
    difficulty: "hard",
    format: "gnd",
    stem: "무릎 반사가 일어날 때의 자극 전달 과정에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "반응의 중추는 척수이다.",
      "자극은 감각 신경을 통해 척수로 전달된다.",
      "척수에서 운동 신경을 통해 다리 근육으로 신호가 전달된다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "무릎 반사는 척수가 중추가 되어(ㄱ), 감각 신경으로 들어온 자극을(ㄴ) 척수에서 바로 운동 신경으로 내보내 다리 근육을 움직여요(ㄷ). 셋 다 옳은 설명이에요.",
  },
  {
    id: "std_bio_nerve_c_q09",
    difficulty: "hard",
    stem: "무조건 반사가 우리 몸에서 중요한 역할을 하는 까닭으로 가장 알맞은 것은?",
    choices: [
      "대뇌가 자극을 오래 기억할 수 있게 해 주기 때문이다.",
      "매우 빠르게 일어나 위험한 상황에서 몸을 보호할 수 있기 때문이다.",
      "의식적 반응보다 더 정확하게 판단할 수 있기 때문이다.",
      "여러 감각 기관의 자극을 한꺼번에 처리할 수 있기 때문이다.",
    ],
    answerIndex: 1,
    explanation:
      "무조건 반사는 대뇌의 판단을 거치지 않아 매우 빠르게 일어나요. 그래서 뜨거운 것에 손이 닿거나 물체가 갑자기 날아오는 위험한 상황에서 몸을 보호하는 데 중요한 역할을 해요.",
  },
  {
    id: "std_bio_nerve_c_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "뜨거운 냄비에 손이 닿자마자 자신도 모르게 손을 뗀 뒤, 잠시 후 '앗 뜨거워!'라고 느끼며 소리쳤다. 이 상황에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "손을 뗀 반응은 대뇌의 판단을 거치지 않은 무조건 반사이다.",
      "뜨거움을 느낀 것은 자극이 대뇌까지 전달되었기 때문이다.",
      "손을 뗀 반응은 뜨거움을 느낀 뒤에 일어난 것이다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "손을 뗀 것은 척수가 중추인 무조건 반사라 대뇌를 거치지 않아요(ㄱ). 뜨거움을 '느낀' 것은 자극이 대뇌까지 전달되었기 때문이에요(ㄴ). 경로가 짧은 반사가 먼저 일어나고 느낌은 그 뒤에 오므로 ㄷ은 순서가 반대라 틀렸어요.",
  },
];

/* 생명과학 4단원 — 항상성 (호르몬 · 체온 · 혈당량) */

/* ============================================================
   생명과학 — 항상성과 호르몬 10문제
   교과서 본문 + 그림 4-13 기반
   ============================================================ */
const HORMONE_QUESTIONS = [
  {
    id: "std_bio_homeo_a_q01",
    difficulty: "easy",
    stem: "몸 안팎의 환경이 변해도 적절하게 반응하여 몸의 상태를 일정하게 유지하는 성질을 무엇이라고 하는가?",
    choices: ["항상성", "무조건 반사", "평형 감각", "의식적 반응"],
    answerIndex: 0,
    explanation:
      "기온이 변해도 체온을 일정하게 유지하는 것처럼, 몸 안팎의 환경이 변해도 몸의 상태를 일정하게 유지하는 성질을 항상성이라고 해요.",
  },
  {
    id: "std_bio_homeo_a_q02",
    difficulty: "easy",
    stem: "항상성을 유지하는 데 작용하는 두 가지를 바르게 짝지은 것은?",
    choices: [
      "신경과 뼈",
      "호르몬과 근육",
      "신경과 호르몬",
      "감각 기관과 뼈",
    ],
    answerIndex: 2,
    explanation:
      "항상성은 신경과 호르몬의 작용으로 유지돼요. 두 가지가 함께 작용해 체온이나 혈당량을 일정하게 지켜요.",
  },
  {
    id: "std_bio_homeo_a_q03",
    difficulty: "medium",
    stem: "호르몬이 만들어져 특정 세포에 작용하기까지의 경로로 옳은 것은?",
    choices: [
      "내분비샘 → 신경 → 특정 세포",
      "내분비샘 → 혈액 → 혈관을 통해 온몸 → 특정 세포",
      "혈액 → 내분비샘 → 신경 → 특정 세포",
      "내분비샘 → 소화관 → 혈관 → 특정 세포",
    ],
    answerIndex: 1,
    explanation:
      "호르몬은 내분비샘에서 혈액으로 분비된 다음, 혈관을 통해 온몸으로 이동하여 특정 세포에 작용해요. 신경을 타고 가는 것이 아니라 혈액을 타고 이동한다는 점이 핵심이에요.",
  },
  {
    id: "std_bio_homeo_a_q04",
    difficulty: "medium",
    stem: "호르몬에 대한 설명으로 옳은 것은?",
    choices: [
      "몸의 모든 세포에 똑같이 작용한다.",
      "종류에 관계없이 역할이 모두 같다.",
      "내분비샘에서 만들어져 몸의 기능을 조절하는 물질이다.",
      "신경 세포를 따라 이동하며 신호를 전달한다.",
    ],
    answerIndex: 2,
    explanation:
      "호르몬은 내분비샘에서 만들어져 특정 세포나 기관으로 신호를 전달하여 몸의 기능을 조절하는 물질이에요. 종류에 따라 역할이 서로 다르고, 온몸을 돌지만 정해진 특정 세포에만 작용해요.",
  },
  {
    id: "std_bio_homeo_a_q05",
    difficulty: "medium",
    format: "gnd",
    stem: "신경과 비교했을 때 호르몬의 특징으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "신호가 비교적 천천히 전달된다.",
      "효과가 지속적으로 나타난다.",
      "작용하는 범위가 좁다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "호르몬은 혈액을 타고 이동하므로 신경보다 신호가 천천히 전달되고(ㄱ), 효과는 지속적으로 나타나요(ㄴ). 온몸을 돌기 때문에 작용 범위는 오히려 넓으므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_homeo_a_q06",
    difficulty: "medium",
    stem: "신경을 통한 신호 전달의 특징으로 가장 알맞은 것은?",
    choices: [
      "전달 속도가 느리고 효과가 오래 지속된다.",
      "전달 속도가 빠르고 작용 범위가 비교적 좁다.",
      "혈관을 통해 온몸으로 신호가 전달된다.",
      "내분비샘에서 분비되어 특정 세포에 작용한다.",
    ],
    answerIndex: 1,
    explanation:
      "신경은 호르몬과 반대되는 특징을 가져요. 신호가 빠르게 전달되고 작용 범위가 비교적 좁아요. 혈관을 타고 온몸으로 퍼지는 것은 호르몬의 방식이에요.",
  },
  {
    id: "std_bio_homeo_a_q07",
    difficulty: "hard",
    stem: "호르몬과 신경을 비교한 설명으로 옳지 않은 것은?",
    choices: [
      "호르몬은 혈관을 통해, 신경은 신경 세포를 통해 신호를 전달한다.",
      "호르몬은 효과가 지속적이고, 신경은 상대적으로 일시적이다.",
      "호르몬은 작용 범위가 넓고, 신경은 좁다.",
      "호르몬은 신경보다 신호가 빠르게 전달된다.",
    ],
    answerIndex: 3,
    explanation:
      "호르몬은 혈액을 타고 이동하기 때문에 신경보다 신호가 천천히 전달돼요. 대신 효과가 오래가고 범위가 넓다는 장점이 있어요. 나머지 셋은 모두 옳은 비교예요.",
  },
  {
    id: "std_bio_homeo_a_q08",
    difficulty: "hard",
    format: "gnd",
    stem: "호르몬이 온몸을 돌아다니지만 아무 세포에서나 효과가 나타나지는 않는다. 이와 관련된 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "호르몬은 혈관을 통해 온몸으로 이동한다.",
      "호르몬은 정해진 특정 세포에 작용한다.",
      "호르몬은 종류에 따라 역할이 다르다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "호르몬은 혈관을 통해 온몸으로 이동하지만(ㄱ), 작용하는 대상은 정해진 특정 세포예요(ㄴ). 또 종류마다 역할이 달라요(ㄷ). 셋 다 옳은 설명이에요.",
  },
  {
    id: "std_bio_homeo_a_q09",
    difficulty: "hard",
    stem: "내분비샘에서 호르몬 분비에 이상이 생겼을 때 나타날 수 있는 일로 가장 알맞은 것은?",
    choices: [
      "호르몬이 신경을 대신하여 더 빠르게 작용한다.",
      "너무 적게 분비되거나 너무 많이 분비되면 질병에 걸릴 수 있다.",
      "호르몬이 분비되지 않으면 신경이 자동으로 대신한다.",
      "호르몬 양과 몸의 상태는 관계가 없다.",
    ],
    answerIndex: 1,
    explanation:
      "내분비샘에서 호르몬이 너무 적게 분비되거나 너무 많이 분비되면 질병에 걸릴 수 있어요. 예를 들어 이자에서 인슐린이 제대로 분비되지 않으면 당뇨병에 걸려요.",
  },
  {
    id: "std_bio_homeo_a_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "항상성과 호르몬에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "항상성은 신경과 호르몬의 작용으로 유지된다.",
      "호르몬은 내분비샘에서 혈액으로 분비된다.",
      "호르몬은 신경보다 효과가 빨리 사라진다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "항상성은 신경과 호르몬이 함께 작용해 유지되고(ㄱ), 호르몬은 내분비샘에서 혈액으로 분비돼요(ㄴ). 호르몬은 효과가 지속적으로 나타나므로 ㄷ은 틀렸어요.",
  },
];

/* ============================================================
   생명과학 — 체온 조절과 혈당량 조절 10문제
   교과서 본문 + 그림 4-14 기반
   ============================================================ */
const BODY_REGULATION_QUESTIONS = [
  {
    id: "std_bio_homeo_b_q01",
    difficulty: "easy",
    stem: "체온이 정상보다 높아졌을 때 피부에서 일어나는 변화로 옳은 것은?",
    choices: [
      "피부 혈관이 수축한다.",
      "피부 혈관이 확장되고 땀 분비량이 늘어난다.",
      "몸의 근육이 떨린다.",
      "땀 분비량이 줄어든다.",
    ],
    answerIndex: 1,
    explanation:
      "체온이 높아지면 뇌에서 신호를 보내 피부 혈관을 확장하고 땀 분비량을 늘려요. 그 결과 열이 몸 밖으로 많이 나가 체온이 낮아져요.",
  },
  {
    id: "std_bio_homeo_b_q02",
    difficulty: "easy",
    stem: "혈당량을 낮추는 작용을 하는 호르몬은?",
    choices: ["글루카곤", "티록신", "인슐린", "아드레날린"],
    answerIndex: 2,
    explanation:
      "이자에서 분비되는 인슐린은 혈당량을 낮추고, 같은 이자에서 분비되는 글루카곤은 혈당량을 높여요.",
  },
  {
    id: "std_bio_homeo_b_q03",
    difficulty: "medium",
    stem: "추운 곳에 있을 때 체온을 높이기 위해 우리 몸에서 일어나는 변화로 옳은 것은?",
    choices: [
      "피부 혈관이 확장되고 땀이 많이 난다.",
      "피부 혈관이 수축하고 몸의 근육이 떨린다.",
      "피부 혈관이 수축하고 땀 분비량이 늘어난다.",
      "피부 혈관이 확장되고 근육이 떨린다.",
    ],
    answerIndex: 1,
    explanation:
      "체온이 낮아지면 피부 혈관이 수축해 열이 몸 밖으로 적게 나가고, 근육이 떨려 몸에서 열이 많이 발생해요. 두 가지가 함께 일어나 체온이 높아져요.",
  },
  {
    id: "std_bio_homeo_b_q04",
    difficulty: "medium",
    stem: "티록신에 대한 설명으로 옳은 것은?",
    choices: [
      "이자에서 분비되며 혈당량을 낮춘다.",
      "갑상샘에서 분비되며 세포 호흡을 촉진한다.",
      "간에서 분비되며 열 발생을 줄인다.",
      "피부에서 분비되며 땀 분비량을 조절한다.",
    ],
    answerIndex: 1,
    explanation:
      "티록신은 갑상샘에서 분비되는 호르몬이에요. 체온이 낮아지면 티록신 분비량이 늘어나 세포 호흡이 촉진되고, 그 결과 몸에서 열이 많이 발생해 체온이 높아져요.",
  },
  {
    id: "std_bio_homeo_b_q05",
    difficulty: "medium",
    stem: "인슐린과 글루카곤이 모두 분비되는 기관은?",
    choices: ["간", "이자", "갑상샘", "소장"],
    answerIndex: 1,
    explanation:
      "인슐린과 글루카곤은 모두 이자에서 분비돼요. 간은 이 호르몬들이 작용하는 기관이고, 소장은 포도당을 흡수하는 기관이에요.",
  },
  {
    id: "std_bio_homeo_b_q06",
    difficulty: "medium",
    format: "gnd",
    stem: "더운 날 체온이 높아졌을 때 우리 몸에서 일어나는 변화로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "뇌에서 신호를 보낸다.",
      "피부 혈관이 확장된다.",
      "열이 몸 밖으로 적게 나간다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "체온이 높아지면 뇌에서 신호를 보내(ㄱ) 피부 혈관을 확장해요(ㄴ). 그 결과 열이 몸 밖으로 '많이' 나가서 체온이 낮아지므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_homeo_b_q07",
    difficulty: "hard",
    stem: "식사를 한 뒤 혈당량이 정상보다 증가했을 때 일어나는 과정으로 옳은 것은?",
    choices: [
      "이자에서 글루카곤이 분비되어 간에 작용한 결과 혈당량이 증가한다.",
      "이자에서 인슐린이 분비되어 간과 세포에 작용한 결과 혈당량이 감소한다.",
      "갑상샘에서 티록신이 분비되어 혈당량이 감소한다.",
      "소장에서 인슐린이 분비되어 혈당량이 감소한다.",
    ],
    answerIndex: 1,
    explanation:
      "식사 후 소장에서 포도당을 흡수하여 혈당량이 정상보다 증가하면, 이자에서 인슐린이 분비되어 간과 세포에 작용한 결과 혈당량이 감소해요.",
  },
  {
    id: "std_bio_homeo_b_q08",
    difficulty: "hard",
    format: "gnd",
    stem: "식사 후 시간이 오래 지나 혈당량이 정상보다 감소했을 때 일어나는 변화로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "이자에서 글루카곤이 분비된다.",
      "글루카곤이 간에 작용한다.",
      "그 결과 혈당량이 증가한다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "혈당량이 정상보다 감소하면 이자에서 글루카곤이 분비되고(ㄱ), 이 호르몬이 간에 작용해(ㄴ) 혈당량이 증가해요(ㄷ). 셋 다 옳은 설명이에요.",
  },
  {
    id: "std_bio_homeo_b_q09",
    difficulty: "hard",
    stem: "이자에서 인슐린이 제대로 분비되지 않을 때 걸릴 수 있는 질병은?",
    choices: ["당뇨병", "빈혈", "근시", "난청"],
    answerIndex: 0,
    explanation:
      "인슐린은 혈당량을 낮추는 호르몬이에요. 이자에서 인슐린이 제대로 분비되지 않으면 혈당량을 낮추지 못해 당뇨병에 걸릴 수 있어요.",
  },
  {
    id: "std_bio_homeo_b_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "체온 조절 과정과 혈당량 조절 과정의 공통점으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "정상 범위에서 벗어나면 다시 정상으로 되돌리는 방향으로 조절된다.",
      "몸의 상태를 일정하게 유지하는 항상성에 해당한다.",
      "두 과정 모두 호르몬 없이 신경만으로 이루어진다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "체온이든 혈당량이든 정상보다 높아지면 낮추고 낮아지면 높이는 방향으로 조절되고(ㄱ), 이것이 바로 항상성이에요(ㄴ). 혈당량 조절에는 인슐린·글루카곤 같은 호르몬이 관여하므로 ㄷ은 틀렸어요.",
  },
];

/* 생명과학 4단원 — 응용 · 심화 (단답형 · 초고난도) */

/* ============================================================
   생명과학 4단원 — 응용: 단답형 10문제 (중간 난이도)
   type: "short_answer" · answers 배열의 값 중 하나와 일치하면 정답
   ============================================================ */
const SHORT_ANSWER_QUESTIONS = [
  {
    id: "std_bio_app_s_q01",
    type: "short_answer",
    difficulty: "medium",
    stem: "눈에서 시각 세포가 분포하여 물체의 상이 맺히는 부분은 어디인가?",
    answers: ["망막"],
    explanation:
      "망막은 눈 안쪽 벽을 이루며 시각 세포가 분포해요. 각막과 수정체를 지나며 굴절된 빛이 여기에 상을 맺어요.",
  },
  {
    id: "std_bio_app_s_q02",
    type: "short_answer",
    difficulty: "medium",
    stem: "망막에서 시각 신경이 모여 나가 시각 세포가 없기 때문에, 상이 맺혀도 보이지 않는 부분은?",
    answers: ["맹점"],
    explanation:
      "맹점은 시각 신경이 모여 눈 밖으로 나가는 자리라 시각 세포가 없어요. 시각 세포가 빽빽하게 모여 가장 선명하게 보이는 황반과 구분해서 기억해야 해요.",
  },
  {
    id: "std_bio_app_s_q03",
    type: "short_answer",
    difficulty: "medium",
    stem: "귀에서 고막의 진동을 증폭하여 달팽이관으로 전달하는 구조는?",
    answers: ["귓속뼈", "귓속 뼈"],
    explanation:
      "고막이 진동하면 그 진동은 귓속뼈를 지나면서 증폭되어 달팽이관으로 전달돼요. 달팽이관은 증폭이 아니라 자극을 받아들이는 곳이에요.",
  },
  {
    id: "std_bio_app_s_q04",
    type: "short_answer",
    difficulty: "medium",
    stem: "혀 표면 돌기의 옆면에 있으며, 그 안에 맛세포가 모여 있는 구조는?",
    answers: ["맛봉오리"],
    explanation:
      "맛봉오리는 혀 표면 돌기의 옆면에 여러 개 있고, 그 안에 맛세포가 모여 있어요. 액체 물질이 맛세포를 자극하면 미각 신경을 통해 뇌로 전달돼요.",
  },
  {
    id: "std_bio_app_s_q05",
    type: "short_answer",
    difficulty: "medium",
    stem: "콧속 윗부분을 덮고 있으며 후각 세포가 분포하는 부분은?",
    answers: ["후각 상피", "후각상피"],
    explanation:
      "콧속 윗부분은 후각 세포가 있는 후각 상피로 덮여 있어요. 기체 물질이 이 후각 세포를 자극하면 후각 신경을 통해 뇌로 전달돼요.",
  },
  {
    id: "std_bio_app_s_q06",
    type: "short_answer",
    difficulty: "medium",
    stem: "중추 신경계를 이루며, 자극을 느끼고 판단하여 운동 뉴런에 반응 신호를 보내는 뉴런은?",
    answers: ["연합 뉴런", "연합뉴런"],
    explanation:
      "연합 뉴런은 중추 신경계를 이루는 뉴런이에요. 감각 뉴런에서 온 자극을 느끼고 판단한 뒤 운동 뉴런으로 신호를 보내요.",
  },
  {
    id: "std_bio_app_s_q07",
    type: "short_answer",
    difficulty: "medium",
    stem: "무릎뼈 아래를 쳤을 때 다리가 들리는 반응처럼, 대뇌의 판단 과정을 거치지 않아 의지와 관계없이 일어나는 반응을 무엇이라고 하는가?",
    answers: ["무조건 반사", "무조건반사"],
    explanation:
      "무조건 반사는 대뇌를 거치지 않아 경로가 짧고 단순해서 매우 빠르게 일어나요. 그래서 위험한 상황에서 몸을 보호하는 역할을 해요.",
  },
  {
    id: "std_bio_app_s_q08",
    type: "short_answer",
    difficulty: "medium",
    stem: "무릎 반사에서 자극을 받아 운동 신경으로 바로 신호를 내보내는 중추는 어디인가?",
    answers: ["척수"],
    explanation:
      "무릎 반사는 자극이 감각 신경을 통해 척수로 전달된 뒤, 척수에서 바로 운동 신경을 통해 다리 근육으로 신호가 가요. 척수가 이 반응의 중추예요.",
  },
  {
    id: "std_bio_app_s_q09",
    type: "short_answer",
    difficulty: "medium",
    stem: "갑상샘에서 분비되며, 세포 호흡을 촉진하여 몸에서 열이 많이 발생하게 하는 호르몬은?",
    answers: ["티록신"],
    explanation:
      "체온이 낮아지면 갑상샘에서 티록신 분비량이 늘어나 세포 호흡이 촉진돼요. 그 결과 열이 많이 발생해 체온이 높아져요.",
  },
  {
    id: "std_bio_app_s_q10",
    type: "short_answer",
    difficulty: "medium",
    stem: "이자에서 분비되며 혈당량을 높이는 작용을 하는 호르몬은?",
    answers: ["글루카곤"],
    explanation:
      "글루카곤은 이자에서 분비되어 간에 작용해 혈당량을 높여요. 같은 이자에서 나오면서 혈당량을 낮추는 인슐린과 짝을 이뤄 혈당량을 일정하게 유지해요.",
  },
];

/* ============================================================
   생명과학 4단원 — 심화: 초고난도 10문제
   여러 단원을 엮거나, 흔한 오개념을 정면으로 겨냥한 문항
   ============================================================ */
const ADVANCED_QUESTIONS = [
  {
    id: "std_bio_adv_q01",
    difficulty: "hard",
    format: "gnd",
    stem: "어두운 방에 있다가 갑자기 밝은 곳으로 나가자 자신도 모르게 동공이 작아졌다. 이 반응에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "대뇌의 판단 과정을 거치지 않는 무조건 반사이다.",
      "이 반응의 중추는 중간뇌이다.",
      "홍채가 수축하여 동공이 작아진 것이다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "밝기에 따른 동공 변화는 의지와 관계없이 일어나는 무조건 반사이고(ㄱ), 그 중추는 중간뇌예요(ㄴ). 다만 밝을 때는 홍채가 '확장'되어 동공이 작아지므로 ㄷ은 틀렸어요. 홍채와 동공이 반대로 움직인다는 점이 함정이에요.",
  },
  {
    id: "std_bio_adv_q02",
    difficulty: "hard",
    stem: "어떤 사람은 소리를 전혀 듣지 못하지만, 고막과 귓속뼈는 정상이고 달팽이관의 청각 세포도 정상인 것으로 확인되었다. 이상이 있을 가능성이 가장 큰 곳은?",
    choices: ["귓바퀴", "외이도", "반고리관", "청각 신경"],
    answerIndex: 3,
    explanation:
      "소리 전달 경로는 귓바퀴 → 외이도 → 고막 → 귓속뼈 → 달팽이관 → 청각 신경 → 뇌예요. 달팽이관까지 정상인데 듣지 못한다면, 그 다음 단계인 청각 신경이 자극을 뇌로 전달하지 못하는 것이에요. 반고리관은 평형 감각을 담당해 청각과 무관해요.",
  },
  {
    id: "std_bio_adv_q03",
    difficulty: "hard",
    format: "gnd",
    stem: "뜨거운 주전자에 손이 닿자 자신도 모르게 손을 뗀 뒤, 곧이어 뜨거움을 느끼고 \"앗!\" 하고 소리쳤다. 이에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "손을 뗀 반응과 뜨거움을 느낀 것은 서로 다른 경로를 거쳤다.",
      "손을 뗀 반응에서는 자극이 감각 신경을 거치지 않았다.",
      "뜨거움을 느낀 뒤에 손을 떼는 반응이 일어났다.",
    ],
    choices: ["ㄱ", "ㄴ", "ㄱ, ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 0,
    explanation:
      "손을 뗀 것은 척수가 중추인 무조건 반사, 뜨거움을 느낀 것은 대뇌까지 간 경로라서 서로 다른 경로예요(ㄱ). 무조건 반사도 자극은 반드시 감각 신경을 통해 척수로 가므로 ㄴ은 틀렸고, 경로가 짧은 반사가 먼저 일어나므로 ㄷ도 순서가 반대예요.",
  },
  {
    id: "std_bio_adv_q04",
    difficulty: "hard",
    stem: "감각 기관, 그 기관의 감각 세포, 자극을 뇌로 전달하는 신경을 바르게 짝지은 것은?",
    choices: [
      "눈 — 시각 세포 — 후각 신경",
      "코 — 후각 세포 — 후각 신경",
      "귀 — 맛세포 — 청각 신경",
      "혀 — 후각 세포 — 미각 신경",
    ],
    answerIndex: 1,
    explanation:
      "코에서는 후각 상피의 후각 세포가 기체 물질을 받아들이고, 그 자극이 후각 신경을 통해 뇌로 전달돼요. 나머지는 감각 세포나 신경 중 하나를 다른 기관 것으로 바꿔치기한 오답이에요.",
  },
  {
    id: "std_bio_adv_q05",
    difficulty: "hard",
    format: "gnd",
    stem: "어떤 환자는 자극을 정확히 느끼고 무엇을 해야 할지 판단할 수 있지만, 팔을 움직이라는 생각대로 팔이 움직이지 않는다. 이 환자에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "감각 뉴런은 정상일 가능성이 크다.",
      "연합 뉴런은 정상일 가능성이 크다.",
      "운동 뉴런에 이상이 있을 가능성이 크다.",
    ],
    choices: ["ㄱ", "ㄷ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 4,
    explanation:
      "자극을 느낀다는 것은 감각 뉴런이 자극을 전달했다는 뜻이고(ㄱ), 판단이 된다는 것은 연합 뉴런이 작동한다는 뜻이에요(ㄴ). 그런데 근육이 움직이지 않으므로 마지막 단계인 운동 뉴런에 이상이 있을 가능성이 커요(ㄷ). 셋 다 옳아요.",
  },
  {
    id: "std_bio_adv_q06",
    difficulty: "hard",
    stem: "추운 곳에 오래 있었을 때 몸에서 일어나는 변화를 순서와 결과까지 바르게 설명한 것은?",
    choices: [
      "피부 혈관이 확장되고 땀이 늘어 열 방출이 줄어든다.",
      "피부 혈관이 수축하여 열 방출이 줄고, 근육이 떨려 열 발생이 늘어난다.",
      "티록신 분비량이 줄어 세포 호흡이 촉진되고 열이 많이 발생한다.",
      "피부 혈관이 수축하여 열 방출이 늘고, 근육이 떨려 열 발생이 줄어든다.",
    ],
    answerIndex: 1,
    explanation:
      "체온이 낮아지면 피부 혈관이 수축해 열이 몸 밖으로 적게 나가고, 근육이 떨려 몸에서 열이 많이 발생해요. 티록신은 분비량이 '늘어나' 세포 호흡을 촉진하므로 3번은 방향이 반대예요.",
  },
  {
    id: "std_bio_adv_q07",
    difficulty: "hard",
    format: "gnd",
    stem: "이자에서 인슐린이 제대로 분비되지 않는 사람에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "식사 후 혈당량을 정상 범위로 낮추기 어렵다.",
      "혈당량을 높이는 호르몬인 글루카곤도 반드시 함께 분비되지 않는다.",
      "호르몬 분비 이상으로 생기는 질병에 해당한다.",
    ],
    choices: ["ㄱ", "ㄴ", "ㄱ, ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "인슐린은 혈당량을 낮추는 호르몬이라 제대로 분비되지 않으면 식사 후 혈당량을 낮추기 어렵고(ㄱ), 이는 호르몬 분비 이상으로 생기는 질병이에요(ㄷ). 인슐린과 글루카곤은 서로 다른 호르몬이므로 하나에 이상이 있다고 다른 하나도 반드시 분비되지 않는 것은 아니에요. ㄴ은 틀렸어요.",
  },
  {
    id: "std_bio_adv_q08",
    difficulty: "hard",
    stem: "신경과 호르몬을 이용한 신호 전달을 비교한 설명으로 옳은 것은?",
    choices: [
      "호르몬은 신경보다 전달이 빠르고 효과가 오래 지속된다.",
      "신경은 혈관을 통해, 호르몬은 신경 세포를 통해 신호를 전달한다.",
      "호르몬은 전달이 느린 대신 효과가 지속적이고 작용 범위가 넓다.",
      "신경과 호르몬은 모두 온몸의 모든 세포에 똑같이 작용한다.",
    ],
    answerIndex: 2,
    explanation:
      "호르몬은 혈액을 타고 이동하므로 신경보다 전달이 느리지만, 효과가 오래가고 작용 범위가 넓어요. '느리다'와 '오래간다'를 함께 붙잡는 것이 핵심이에요. 신경이 혈관을 쓴다는 2번은 둘을 맞바꾼 진술이에요.",
  },
  {
    id: "std_bio_adv_q09",
    difficulty: "hard",
    stem: "달리기를 하다가 앞에서 날아온 공을 보고 고개를 숙여 피했다. 이 반응에 대한 설명으로 가장 알맞은 것은?",
    choices: [
      "자극은 눈 → 감각 신경 → 척수에서 바로 운동 신경으로 전달되었다.",
      "자극은 눈 → 감각 신경 → 대뇌 → 운동 신경 → 목 근육으로 전달되었다.",
      "대뇌를 거치지 않았으므로 무조건 반사에 해당한다.",
      "자극이 운동 신경을 통해 대뇌로 전달된 뒤 반응이 일어났다.",
    ],
    answerIndex: 1,
    explanation:
      "공을 '보고' 피하겠다고 판단해 고개를 숙인 것은 대뇌의 판단을 거친 의식적 반응이에요. 자극은 감각 신경을 통해 대뇌로 가고, 대뇌가 판단한 뒤 운동 신경으로 신호가 나가요. 자극은 감각 신경으로 들어오고 운동 신경으로 나간다는 방향도 함께 기억해야 해요.",
  },
  {
    id: "std_bio_adv_q10",
    difficulty: "synthesis",
    format: "gnd",
    stem: "감각 기관, 신경계, 항상성을 아우르는 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "감각 기관은 자극을 받아들이지만, 자극을 실제로 인식하는 곳은 뇌이다.",
      "무조건 반사는 중추가 대뇌가 아니므로 자극이 대뇌로 전혀 전달되지 않는다.",
      "항상성은 신경과 호르몬이 함께 작용하여 유지된다.",
    ],
    choices: ["ㄱ", "ㄴ", "ㄱ, ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 2,
    explanation:
      "감각 기관은 자극을 받아들일 뿐 인식은 뇌가 하고(ㄱ), 항상성은 신경과 호르몬이 함께 유지해요(ㄷ). 무조건 반사는 '반응'이 대뇌를 거치지 않을 뿐, 자극 자체는 대뇌로도 전달되어 뒤늦게 느끼게 되므로 ㄴ은 틀렸어요.",
  },
];

/* 과목 → 모듈 → 레슨 구조. 새 문제 세트는 여기에 등록한다. */

/* ============================================================
   과목 / 모듈 / 레슨 구조
   생명과학 문제를 더 추가할 때는 아래 lessons 배열에
   { id, title, status: "available", questions: [...] } 형태로 넣으면 돼요.
   ============================================================ */
const SUBJECTS = [
  {
    id: "physics",
    title: "물리 · 운동과 에너지",
    emoji: "🚗",
    color: "var(--primary)",
    soft: "var(--primary-soft)",
    modules: [
      {
        id: "motion-energy",
        title: "운동과 에너지",
        lessons: [
          {
            id: "std_2_3_3_a_lo_a1_lesson",
            title: "등속 운동",
            icon: "ruler",
            status: "available",
            questions: MOTION_LESSON_QUESTIONS,
          },
          { id: "lo_free_fall", title: "자유 낙하 운동", icon: "arrow-down", status: "locked" },
          { id: "lo_work_energy", title: "일과 에너지", icon: "circle", status: "locked" },
        ],
      },
      {
        id: "energy-conversion",
        title: "에너지 전환과 보존",
        lessons: [
          { id: "lo_mech_energy", title: "역학적 에너지 보존", icon: "wave", status: "locked" },
          { id: "lo_electric", title: "발전과 전류", icon: "bolt", status: "locked" },
        ],
      },
    ],
  },
  {
    id: "biology",
    title: "생명과학 · 자극과 반응",
    emoji: "🧬",
    color: "var(--success)",
    soft: "var(--success-soft)",
    modules: [
      {
        id: "sense-organs",
        title: "감각 기관",
        lessons: [
          {
            id: "std_bio_sense_a_eye_lesson",
            title: "눈",
            status: "available",
            // 개념 영상: public/videos/ 안의 파일 경로 또는 유튜브 주소
            video: "/videos/unit4-eye.mp4",
            questions: EYE_QUESTIONS,
          },
          {
            id: "std_bio_sense_a_ear_lesson",
            title: "귀",
            status: "available",
            questions: EAR_QUESTIONS,
          },
          {
            id: "std_bio_sense_a_skin_lesson",
            title: "피부 감각",
            status: "available",
            questions: SKIN_QUESTIONS,
          },
          {
            id: "std_bio_sense_a_taste_smell_lesson",
            title: "혀 · 코 (미각 · 후각)",
            status: "available",
            questions: TASTE_SMELL_QUESTIONS,
          },
        ],
      },
      {
        id: "nervous-system",
        title: "신경계",
        lessons: [
          {
            id: "std_bio_nerve_a_lesson",
            title: "신경계의 구성과 중추 신경계",
            status: "available",
            questions: NERVOUS_SYSTEM_QUESTIONS,
          },
          {
            id: "std_bio_nerve_b_lesson",
            title: "뉴런과 자극의 전달",
            status: "available",
            questions: NEURON_QUESTIONS,
          },
          {
            id: "std_bio_nerve_c_lesson",
            title: "의식적 반응과 무조건 반사",
            status: "available",
            questions: REFLEX_QUESTIONS,
          },
        ],
      },
      {
        id: "homeostasis",
        title: "항상성",
        lessons: [
          {
            id: "std_bio_homeo_a_lesson",
            title: "항상성과 호르몬",
            status: "available",
            questions: HORMONE_QUESTIONS,
          },
          {
            id: "std_bio_homeo_b_lesson",
            title: "체온 조절과 혈당량 조절",
            status: "available",
            questions: BODY_REGULATION_QUESTIONS,
          },
        ],
      },
      {
        id: "bio-advanced",
        title: "응용 · 심화",
        lessons: [
          {
            id: "std_bio_app_short_lesson",
            title: "단답형 확인 문제",
            status: "available",
            questions: SHORT_ANSWER_QUESTIONS,
          },
          {
            id: "std_bio_adv_lesson",
            title: "초고난도 심화 문제",
            status: "available",
            questions: ADVANCED_QUESTIONS,
          },
        ],
      },
    ],
  },
];

/* 모든 단원의 문제를 하나의 목록으로 펼친다.
   "오늘의 랜덤 10"이 단원을 가리지 않고 이미 푼 문제 중에서 뽑을 때 쓴다. */
function allQuestionsFlat() {
  const list = [];
  for (const subject of SUBJECTS) {
    for (const mod of subject.modules) {
      for (const lesson of mod.lessons) {
        if (!lesson.questions) continue;
        for (const q of lesson.questions) {
          list.push({ ...q, lessonId: lesson.id, lessonTitle: lesson.title });
        }
      }
    }
  }
  return list;
}

/* 미리보기 빌드: 서버 모드 없음 */
const serverMode = false;

/* ============================================================ */

function ProgressBar({ pct, colorVar = "var(--primary)" }) {
  return (
    <div style={{ height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: colorVar,
          borderRadius: 99,
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--card)",
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 6px 18px rgba(31,32,48,.05)",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "solid", disabled, style }) {
  const base = {
    width: "100%",
    height: 50,
    borderRadius: 16,
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    letterSpacing: "-.1px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
  const variants = {
    solid: { background: "var(--primary)", color: "#fff" },
    outline: { background: "#fff", color: "var(--primary)", border: "1.5px solid var(--primary)" },
    ghost: { background: "transparent", color: "var(--text-2)", height: 40 },
    success: { background: "var(--success)", color: "#fff" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function BottomNav({ active, onNav }) {
  const items = [
    { id: "home", label: "홈", icon: HomeIcon },
    { id: "modules", label: "학습", icon: BookOpen },
    { id: "stats", label: "기록", icon: TrendingUp },
    { id: "me", label: "마이", icon: User },
  ];
  return (
    <div
      style={{
        display: "flex",
        borderTop: "1px solid var(--line)",
        background: "#fff",
        padding: "8px 4px 14px",
        flexShrink: 0,
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const on = active === it.id;
        return (
          <div
            key={it.id}
            onClick={() => onNav(it.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              color: on ? "var(--primary)" : "var(--text-3)",
            }}
          >
            <Icon size={20} strokeWidth={2} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
      }}
    >
      {onBack ? (
        <ChevronLeft size={22} onClick={onBack} style={{ cursor: "pointer" }} />
      ) : (
        <span style={{ width: 22 }} />
      )}
      <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
      {right || <span style={{ width: 22 }} />}
    </div>
  );
}

/* ============================================================
   화면들
   ============================================================ */

/* 오늘의 랜덤 10 카드 — 이미 풀어본 문제 중에서, 틀린 적 있는 문제가
   2배 더 잘 뽑히도록 계정별로 매일 새로 골라진다. */
function DailyChallengeCard({ progress, onStart }) {
  const dc = progress.dailyChallenge;
  const solvedCount = Object.values(progress.questionStats || {}).filter(
    (s) => s.attempts > 0
  ).length;

  if (!dc || dc.questionIds.length === 0) {
    const remaining = Math.max(0, DAILY_MIN_SOLVED - solvedCount);
    return (
      <Card style={{ marginTop: 10, opacity: 0.7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>🎲</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>오늘의 랜덤 10</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {remaining > 0
                ? `문제를 ${remaining}개 더 풀면 열려요`
                : "내일 다시 확인해 보세요"}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (dc.done) {
    return (
      <Card style={{ marginTop: 10, background: "var(--success-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>✅</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--success)" }}>
              오늘의 랜덤 10 완료!
            </div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>
              {dc.correctIds.length}/{dc.questionIds.length} 정답 · 내일 새 문제로 돌아와요
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 10, background: "var(--primary-light)", cursor: "pointer" }} onClick={onStart}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 22 }}>🎲</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--primary)" }}>오늘의 랜덤 10</div>
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>
            이미 푼 문제 {dc.questionIds.length}개 · 틀렸던 문제가 더 자주 나와요
          </div>
        </div>
        <ChevronRight size={18} color="var(--primary)" />
      </div>
    </Card>
  );
}

function HomeScreen({ progress, onOpenModules, onNav, onStartDaily }) {
  const level = levelOf(progress.xp);
  const intoLevel = xpIntoLevel(progress.xp);

  function subjectProgress(subj) {
    const lessons = subj.modules.flatMap((m) => m.lessons);
    const total = lessons.filter((l) => l.status === "available").length;
    const done = lessons.filter(
      (l) => l.status === "available" && progress.completedLessons.includes(l.id)
    ).length;
    return { done, total };
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
    <div className="scroll-col" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 18px 0", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
      <div style={{ fontWeight: 700, fontSize: 18 }}>안녕하세요! 👋</div>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>오늘도 문제 풀며 개념을 다져봐요.</div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div
          style={{
            width: 78,
            background: "var(--primary-light)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "10px 0",
          }}
        >
          <div style={{ fontSize: 20 }}>🏆</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--primary)" }}>Lv.{level}</div>
        </div>
        <div style={{ flex: 1, background: "var(--primary-light)", borderRadius: 16, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>다음 레벨까지</span>
            <span style={{ fontSize: 11, color: "var(--text-2)" }}>
              <b style={{ color: "var(--primary)", fontSize: 14 }}>{intoLevel}</b>/100
            </span>
          </div>
          <ProgressBar pct={intoLevel} />
        </div>
      </div>

      <Card style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "var(--warn-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Flame size={20} color="var(--warn)" fill="var(--warn)" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 700 }}>연속 학습</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{progress.streak}일</div>
        </div>
      </Card>

      <DailyChallengeCard progress={progress} onStart={onStartDaily} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>내 학습 모듈</div>
        <div onClick={onOpenModules} style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", cursor: "pointer" }}>
          전체 보기
        </div>
      </div>

      {SUBJECTS.map((subj) => {
        const { done, total } = subjectProgress(subj);
        return (
        <Card
          key={subj.id}
          onClick={() => onOpenModules(subj.id)}
          style={{ marginBottom: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: subj.soft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              {subj.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{subj.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {`완료 ${done}/${total} 레슨`}
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-3)" />
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar pct={total ? (done / total) * 100 : 0} colorVar={subj.color} />
          </div>
        </Card>
        );
      })}

      <div
        style={{
          marginTop: 6,
          padding: "12px 14px",
          borderRadius: 14,
          background: "var(--card)",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-2)" }}>
          이 앱의 문제와 해설은 <b>AI가 만든 학습 참고용 자료</b>이며, 공식 교재나 기출 문제가
          아니에요. 오류가 있을 수 있으니 교과서와 함께 확인하며 사용해 주세요.
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-3)", marginTop: 6 }}>
          {serverMode
            ? "학습 기록은 계정에 저장돼요. 계정 관리는 마이 화면에서 할 수 있어요."
            : "학습 기록은 이 기기에만 저장돼요."}
        </div>
      </div>

      <div style={{ height: 12 }} />
    </div>
      <BottomNav active="home" onNav={onNav} />
    </div>
  );
}

function ModulesScreen({ subjectId, onBack, onStartLesson, progress }) {
  const subject = SUBJECTS.find((s) => s.id === subjectId) || SUBJECTS[0];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title={subject.title} onBack={onBack} />
      <div style={{ flex: 1, padding: "0 18px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
        {subject.modules.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--text-2)" }}>
            <Dna size={40} color={subject.color} style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 700 }}>콘텐츠가 곧 추가돼요</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>문제 세트가 준비되는 대로 열릴 예정이에요.</div>
          </div>
        ) : (
          subject.modules.map((mod) => {
            const availableCount = mod.lessons.filter((l) => l.status === "available").length;
            const doneCount = mod.lessons.filter(
              (l) => l.status === "available" && progress.completedLessons.includes(l.id)
            ).length;
            return (
              <Card key={mod.id} style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{mod.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 700 }}>
                    {doneCount}/{availableCount || mod.lessons.length} 완료
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  {mod.lessons.map((lesson) => {
                    const locked = lesson.status !== "available";
                    const done = progress.completedLessons.includes(lesson.id);
                    const best = progress.lessonBest[lesson.id];
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => !locked && onStartLesson(lesson)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 4px",
                          borderBottom: "1px solid var(--line)",
                          cursor: locked ? "default" : "pointer",
                          opacity: locked ? 0.55 : 1,
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: locked ? "var(--bg)" : "var(--primary-light)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {locked ? (
                            <Lock size={16} color="var(--text-3)" />
                          ) : (
                            <Beaker size={16} color="var(--primary)" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{lesson.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {lesson.video && !locked && (
                              <span style={{ color: "var(--primary)", fontWeight: 700 }}>영상 · </span>
                            )}
                            {locked
                              ? "곧 추가돼요"
                              : best
                              ? `최고 ${best.correct}/${best.total} · 다시 풀기`
                              : `문제 ${lesson.questions?.length ?? 0}개`}
                          </div>
                        </div>
                        {!locked && (done ? <Check size={16} color="var(--success)" /> : <ChevronRight size={16} color="var(--text-3)" />)}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

/* ============================================================
   개념 영상
   lesson.video 에 파일 경로("/videos/x.mp4") 또는 유튜브 주소를 넣으면
   문제 풀기 전에 영상 화면이 먼저 나온다.
   ============================================================ */

/* 유튜브 주소면 영상 ID 를 뽑아낸다. 아니면 null */
function youtubeIdOf(url) {
  const value = String(url || "");
  const m =
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    value.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    value.match(/youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function VideoPlayer({ src }) {
  const ytId = youtubeIdOf(src);
  const box = {
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#000",
    borderRadius: 16,
    overflow: "hidden",
  };

  if (ytId) {
    return (
      <div style={box}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`}
          title="개념 영상"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </div>
    );
  }

  return (
    <div style={box}>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        이 브라우저는 영상 재생을 지원하지 않아요.
      </video>
    </div>
  );
}

function LessonIntroScreen({ lesson, onStart, onBack }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title={lesson.title} onBack={onBack} />
      <div
        className="scroll-col"
        style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 18px 18px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--primary)",
            background: "var(--primary-soft)",
            width: "fit-content",
            padding: "3px 8px",
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          개념 영상
        </div>

        <VideoPlayer src={lesson.video} />

        <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-2)", marginTop: 14 }}>
          영상을 보고 나서 문제를 풀면 훨씬 잘 풀려요. 문제를 풀다가 다시 보고 싶으면 뒤로
          돌아오면 돼요.
        </div>

        <div style={{ marginTop: "auto", paddingTop: 18 }}>
          <Button onClick={onStart}>문제 풀기 ({lesson.questions?.length ?? 0}문제)</Button>
        </div>
      </div>
    </div>
  );
}

/* 단답형 채점용 정규화: 공백·문장부호 제거 */
function normalizeAnswer(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[.,!?·'"()]/g, "")
    .toLowerCase();
}

function QuizScreen({ lesson, onExit, onFinish }) {
  const questions = lesson.questions;
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [inputText, setInputText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [answered, setAnswered] = useState(false);
  const [correctIds, setCorrectIds] = useState([]);
  const [wrongIds, setWrongIds] = useState([]);

  const q = questions[qIndex];
  const isShortAnswer = q.type === "short_answer";
  const isCorrect = isShortAnswer
    ? (q.answers || []).some((a) => normalizeAnswer(a) === normalizeAnswer(submittedText))
    : selected === q.answerIndex;

  function record(ok) {
    setAnswered(true);
    if (ok) setCorrectIds((prev) => [...prev, q.id]);
    else setWrongIds((prev) => [...prev, q.id]);
  }

  function selectChoice(i) {
    if (answered) return;
    setSelected(i);
    record(i === q.answerIndex);
  }

  function submitText() {
    if (answered) return;
    const text = inputText.trim();
    if (!text) return;
    setSubmittedText(text);
    record((q.answers || []).some((a) => normalizeAnswer(a) === normalizeAnswer(text)));
  }

  function next() {
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
      setSelected(null);
      setInputText("");
      setSubmittedText("");
      setAnswered(false);
    } else {
      onFinish({
        correctIds,
        wrongIds,
        total: questions.length,
      });
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar
        title={`${qIndex + 1} / ${questions.length}`}
        onBack={onExit}
        right={<X size={20} onClick={onExit} style={{ cursor: "pointer" }} />}
      />
      <div style={{ padding: "0 18px 4px" }}>
        <ProgressBar pct={((qIndex + (answered ? 1 : 0)) / questions.length) * 100} />
      </div>

      <div className="scroll-col" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 18px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
        {!answered && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--primary)",
                background: "var(--primary-soft)",
                width: "fit-content",
                padding: "3px 8px",
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              {q.difficulty === "easy"
                ? "쉬움"
                : q.difficulty === "medium"
                ? "보통"
                : q.difficulty === "hard"
                ? "어려움"
                : "종합"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>{q.stem}</div>

            {q.svg && (
              <div
                style={{
                  marginTop: 14,
                  background: "#fff",
                  borderRadius: 14,
                  padding: 10,
                  display: "flex",
                  justifyContent: "center",
                  border: "1px solid var(--line)",
                }}
                dangerouslySetInnerHTML={{ __html: q.svg }}
              />
            )}

            {q.boxItems && (
              <div
                style={{
                  marginTop: 14,
                  border: "1.5px solid var(--text-3)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "var(--bg)",
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-2)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  보기
                </div>
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                  {q.boxItems.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, fontSize: 13.5, lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>{"ㄱㄴㄷㄹㅁ"[i]}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isShortAnswer ? (
              <div style={{ marginTop: 20 }}>
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitText();
                  }}
                  placeholder="답을 입력하세요"
                  style={{
                    width: "100%",
                    height: 50,
                    borderRadius: 14,
                    border: "1.5px solid var(--line)",
                    padding: "0 14px",
                    fontSize: 15,
                    fontWeight: 600,
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ marginTop: 10 }}>
                  <Button onClick={submitText} disabled={!inputText.trim()}>
                    확인
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                {q.choices.map((choice, i) => (
                  <div
                    key={i}
                    onClick={() => selectChoice(i)}
                    style={{
                      border: "1.5px solid var(--line)",
                      borderRadius: 14,
                      padding: "13px 14px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "#fff",
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "var(--text-3)", flexShrink: 0 }}>{"①②③④⑤"[i]}</span>
                    <span>{choice}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {answered && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <div style={{ fontSize: 44 }}>{isCorrect ? "🎉" : "😢"}</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: isCorrect ? "var(--success)" : "var(--danger)",
                  marginTop: 6,
                }}
              >
                {isCorrect ? "정답이에요!" : "아쉬워요, 다시 확인해봐요"}
              </div>
              {isCorrect && (
                <div style={{ fontWeight: 700, color: "var(--primary)", marginTop: 4, fontSize: 13 }}>+20 에너지</div>
              )}
            </div>

            {!isCorrect && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {q.boxItems && (
                  <div
                    style={{
                      border: "1.5px solid var(--text-3)",
                      borderRadius: 12,
                      overflow: "hidden",
                      marginBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        background: "var(--bg)",
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-2)",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      보기
                    </div>
                    <div style={{ padding: "9px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {q.boxItems.map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 7, fontSize: 12.5, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 700, flexShrink: 0 }}>{"ㄱㄴㄷㄹㅁ"[i]}.</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isShortAnswer ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 4 }}>
                      {q.stem}
                    </div>
                    <div
                      style={{
                        border: "1.5px solid var(--danger)",
                        background: "var(--danger-soft)",
                        borderRadius: 14,
                        padding: "11px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 3 }}>내 답</div>
                      {submittedText}
                    </div>
                    <div
                      style={{
                        border: "1.5px solid var(--success)",
                        background: "var(--success-soft)",
                        borderRadius: 14,
                        padding: "11px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 3 }}>정답</div>
                      {(q.answers || [])[0]}
                    </div>
                  </>
                ) : (
                  q.choices.map((choice, i) => {
                  const isRight = i === q.answerIndex;
                  const isPicked = i === selected;
                  return (
                    <div
                      key={i}
                      style={{
                        border: `1.5px solid ${isRight ? "var(--success)" : isPicked ? "var(--danger)" : "var(--line)"}`,
                        background: isRight ? "var(--success-soft)" : isPicked ? "var(--danger-soft)" : "#fff",
                        borderRadius: 14,
                        padding: "11px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: "var(--text-3)", flexShrink: 0 }}>{"①②③④⑤"[i]}</span>
                      <span>{choice}</span>
                    </div>
                  );
                  })
                )}
              </div>
            )}

            <Card style={{ marginTop: 16, background: "var(--primary-soft)" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--primary)" }}>해설</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>{q.explanation}</div>
            </Card>

            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <Button onClick={next}>{qIndex + 1 < questions.length ? "다음 문제" : "결과 보기"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultScreen({ result, lesson, onBackToModules, onRetryWrong }) {
  const scorePct = Math.round((result.correctIds.length / result.total) * 100);
  return (
    <div className="scroll-col" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 18px 0", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>🏅</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "var(--primary)", marginTop: 4 }}>
          {lesson.title} 완료!
        </div>
      </div>

      <Card style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 700 }}>내 점수</div>
            <div>
              <span style={{ fontSize: 26, fontWeight: 800 }}>{scorePct}</span>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}> / 100</span>
            </div>
          </div>
          <div
            style={{
              background: "var(--primary-soft)",
              color: "var(--primary)",
              fontWeight: 700,
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: 12,
            }}
          >
            📈 {scorePct}%
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--success)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
              }}
            >
              ✓
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>정답</span>
          </div>
          <span style={{ fontWeight: 800, color: "var(--success)" }}>{result.correctIds.length}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--danger)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
              }}
            >
              ✕
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>오답</span>
          </div>
          <span style={{ fontWeight: 800, color: "var(--danger)" }}>{result.wrongIds.length}</span>
        </div>
      </Card>

      <div style={{ marginTop: "auto", paddingBottom: 18, paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {result.wrongIds.length > 0 && (
          <Button variant="outline" onClick={onRetryWrong}>
            오답 문제 다시 풀기
          </Button>
        )}
        <Button onClick={onBackToModules}>
          {lesson.isDaily ? "홈으로 돌아가기" : "학습 모듈로 돌아가기"}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */

/* ============================================================
   로그인 / 회원가입 화면
   ============================================================ */
function Field({ label, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", marginBottom: 5 }}>
        {label}
      </div>
      <input
        {...props}
        style={{
          width: "100%",
          height: 46,
          borderRadius: 14,
          border: "1.5px solid var(--line)",
          padding: "0 14px",
          fontSize: 14,
          fontWeight: 600,
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
          background: "#fff",
        }}
      />
    </div>
  );
}

function Notice({ text, tone = "danger" }) {
  if (!text) return null;
  const color = tone === "danger" ? "var(--danger)" : "var(--success)";
  const bg = tone === "danger" ? "var(--danger-soft)" : "var(--success-soft)";
  return (
    <div
      style={{
        background: bg,
        color,
        borderRadius: 12,
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 12,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newAccount, setNewAccount] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        if (pw !== pw2) {
          setError("비밀번호가 서로 달라요.");
          return;
        }
        const res = await createAccount(id, pw, email);
        if (res.error) {
          setError(res.error);
          return;
        }
        setNewAccount(res.account);
      } else {
        const res = await login(id, pw);
        if (res.error) {
          setError(res.error);
          return;
        }
        onAuthed(res.account);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await requestPasswordReset(email);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSentTo(email.trim());
    } finally {
      setBusy(false);
    }
  }

  /* 비밀번호 찾기 — 메일 보낸 뒤 */
  if (sentTo) {
    return (
      <div
        className="scroll-col"
        style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 20px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ textAlign: "center", marginTop: 30 }}>
          <div style={{ fontSize: 40 }}>📮</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>메일을 보냈어요</div>
        </div>
        <Card style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)" }}>
            <b style={{ color: "var(--text)" }}>{sentTo}</b> 로 비밀번호를 다시 정하는 링크를
            보냈어요. 메일함을 확인하고 링크를 눌러 주세요.
            <br />
            <br />
            메일이 안 보이면 스팸함도 확인해 보세요. 그 주소로 가입한 계정이 없으면 메일이 오지
            않아요.
          </div>
        </Card>
        <div style={{ marginTop: 18 }}>
          <Button
            variant="outline"
            onClick={() => {
              setSentTo(null);
              setMode("login");
              setError("");
            }}
          >
            로그인으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  /* 가입 직후 — 고유 코드를 반드시 보여준다 */
  if (newAccount) {
    return (
      <div className="scroll-col" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 19, marginTop: 6 }}>계정이 만들어졌어요!</div>
        </div>

        <Card style={{ marginTop: 20, textAlign: "center", background: "var(--primary-light)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>나의 고유 코드</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 1,
              color: "var(--primary)",
              margin: "8px 0 4px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {formatCode(newAccount.code)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>이 코드는 바꿀 수 없어요</div>
        </Card>

        <Card style={{ marginTop: 12, background: "var(--warn-soft)" }}>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text)" }}>
            <b>이 코드를 꼭 적어두세요.</b>
            <br />
            아이디나 비밀번호를 잊었을 때 계정을 찾는 유일한 방법이에요. 코드로도 로그인할 수 있어요.
          </div>
        </Card>

        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <Button onClick={() => onAuthed(newAccount)}>적어뒀어요, 시작하기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-col" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 20px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 38 }}>🧪</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>과학 학습 프로그램</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
          {mode === "forgot"
            ? "가입할 때 등록한 이메일을 알려주세요"
            : mode === "login"
            ? "다시 만나서 반가워요"
            : "계정을 만들어 기록을 저장하세요"}
        </div>
      </div>

      {mode !== "forgot" && (
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[
          { key: "login", label: "로그인" },
          { key: "signup", label: "회원가입" },
        ].map((t) => (
          <div
            key={t.key}
            onClick={() => {
              setMode(t.key);
              setError("");
            }}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 0",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: mode === t.key ? "var(--primary)" : "var(--card)",
              color: mode === t.key ? "#fff" : "var(--text-2)",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>
      )}

      <Notice text={error} />

      {mode === "forgot" ? (
        <>
          <Field
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleForgot();
            }}
            placeholder="가입할 때 등록한 이메일"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <div style={{ marginTop: 6 }}>
            <Button onClick={handleForgot} disabled={busy || !email.trim()}>
              {busy ? "보내는 중..." : "재설정 메일 받기"}
            </Button>
          </div>
          <div style={{ marginTop: 10 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              돌아가기
            </Button>
          </div>
        </>
      ) : (
        <>
          <Field
            label={mode === "login" ? "아이디 또는 고유 코드" : "아이디 (4~16자, 영문·숫자·_)"}
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={mode === "login" ? "아이디 또는 코드" : "아이디"}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Field
            label="비밀번호 (6자 이상)"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mode === "login") handleSubmit();
            }}
            placeholder="비밀번호"
          />
          {mode === "signup" && (
            <>
              <Field
                label="비밀번호 확인"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="한 번 더 입력"
              />
              <Field
                label="이메일 (선택)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder="비밀번호를 잊었을 때 쓸 주소"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "var(--text-3)",
                  marginTop: -6,
                  marginBottom: 12,
                }}
              >
                이메일을 적어두면 비밀번호를 잊어도 다시 정할 수 있어요. 안 적으면 비밀번호를
                잃어버렸을 때 계정을 되찾을 방법이 없어요.
              </div>
            </>
          )}

          <div style={{ marginTop: 6 }}>
            <Button onClick={handleSubmit} disabled={busy || !id.trim() || !pw}>
              {busy ? "처리 중..." : mode === "login" ? "로그인" : "계정 만들기"}
            </Button>
          </div>

          {mode === "login" && serverMode && (
            <div
              onClick={() => {
                setMode("forgot");
                setError("");
              }}
              style={{
                marginTop: 12,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--primary)",
                cursor: "pointer",
              }}
            >
              비밀번호를 잊으셨나요?
            </div>
          )}
        </>
      )}

      <div
        style={{
          marginTop: 18,
          padding: "12px 14px",
          borderRadius: 14,
          background: "var(--card)",
          border: "1px solid var(--line)",
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--text-2)",
        }}
      >
        {serverMode ? (
          <>
            <b style={{ color: "var(--success)" }}>서버에 연결됨</b> · 계정과 학습 기록이 서버에
            저장돼요. 다른 기기에서도 같은 아이디로 로그인하면 이어서 학습할 수 있어요.
          </>
        ) : (
          <>
            계정과 학습 기록은 <b>이 기기에만</b> 저장돼요. 다른 기기에서는 로그인할 수 없고,
            브라우저 저장 공간을 지우면 계정도 사라져요.
            <br />
            <b style={{ color: "var(--danger)" }}>
              다른 곳에서 쓰는 비밀번호를 그대로 쓰지 마세요.
            </b>
          </>
        )}
      </div>

      {!serverMode && (
        <div
          style={{
            marginTop: 10,
            borderRadius: 14,
            background: "var(--warn-soft)",
            border: "1px solid rgba(255,140,66,.35)",
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setShowSetup((v) => !v)}
            style={{
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>
              서버가 아직 연결되지 않았어요
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>
              {showSetup ? "닫기" : "연결하는 법"}
            </span>
          </div>

          {showSetup && (
            <div
              style={{
                padding: "0 14px 13px",
                fontSize: 11,
                lineHeight: 1.75,
                color: "var(--text-2)",
              }}
            >
              서버를 연결하면 <b>다른 기기에서도 같은 아이디로 로그인</b>할 수 있고, 비밀번호가
              안전하게 보관돼요. 무료로 할 수 있어요.
              <ol style={{ margin: "9px 0 0", paddingLeft: 16 }}>
                <li>
                  <b>supabase.com</b> 에 가입하고 새 프로젝트를 만들어요. (지역은 Seoul)
                </li>
                <li>
                  왼쪽 <b>SQL Editor</b> 에서 <code>supabase/schema.sql</code> 내용을 붙여넣고
                  실행해요.
                </li>
                <li>
                  <b>Authentication → Email</b> 에서 <b>Confirm email 을 꺼요.</b> (안 끄면 로그인이
                  막혀요)
                </li>
                <li>
                  <b>Project Settings → API</b> 의 값 두 개를 <code>.env</code> 파일에 넣어요.
                  <br />
                  <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>
                </li>
                <li>배포했다면 Vercel 환경 변수에도 같은 값을 넣고 다시 배포해요.</li>
              </ol>
              <div style={{ marginTop: 9 }}>
                자세한 설명은 프로젝트의 <b>README.md</b> 10번 항목에 있어요. 연결되면 이 안내는
                사라져요.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   마이 화면 — 고유 코드 확인, 아이디·비밀번호 변경
   ============================================================ */
/* ============================================================
   관리자 화면 — 전체 사용자와 학습 기록
   실제 접근 권한은 데이터베이스 정책이 판단한다.
   ============================================================ */
/* 레슨 id 로 레슨 이름을 찾는다 */
function lessonTitleOf(lessonId) {
  for (const subj of SUBJECTS) {
    for (const mod of subj.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.id === lessonId) return lesson.title;
      }
    }
  }
  return lessonId;
}

function AdminScreen({ account, onBack }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [openCode, setOpenCode] = useState(null);
  const [confirm, setConfirm] = useState(null); // { code, kind }
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    const res = await fetchAllUsers();
    if (res.error) {
      setError(res.error);
      setUsers([]);
      return;
    }
    setUsers(res.users);
  }

  useEffect(() => {
    load();
  }, []);

  async function runAction() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const res =
        confirm.kind === "reset"
          ? await adminResetProgress(confirm.code)
          : await adminDeleteUser(confirm.code);
      if (res.error) {
        setError(res.error);
      } else {
        setConfirm(null);
        setOpenCode(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title="관리자" onBack={onBack} />
      <div
        style={{ flex: 1, padding: "0 18px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
      >
        <Notice text={error} />

        {users === null && (
          <div style={{ textAlign: "center", marginTop: 40, color: "var(--text-3)", fontSize: 13 }}>
            불러오는 중...
          </div>
        )}

        {users && users.length === 0 && !error && (
          <div style={{ textAlign: "center", marginTop: 40, color: "var(--text-3)", fontSize: 13 }}>
            아직 가입한 사람이 없어요.
          </div>
        )}

        {users && users.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-2)", margin: "8px 0 4px", fontWeight: 700 }}>
            사용자 {users.length}명
          </div>
        )}

        {(users || []).map((u) => {
          const open = openCode === u.code;
          const isMe = u.code === account.code;
          return (
            <Card key={u.code} style={{ marginTop: 10 }}>
              <div
                onClick={() => setOpenCode(open ? null : u.code)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {u.id}
                    {u.isAdmin && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--primary)",
                          background: "var(--primary-soft)",
                          padding: "2px 6px",
                          borderRadius: 8,
                        }}
                      >
                        관리자
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    Lv.{levelOf(u.xp)} · 경험치 {u.xp} · 연속 {u.streak}일 · 완료{" "}
                    {u.completedLessons.length}개
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-3)" />
              </div>

              {open && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.8 }}>
                    고유 코드: <b>{formatCode(u.code)}</b>
                    <br />
                    마지막 학습: {u.lastStudyDate || "없음"}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>
                      레슨별 최고 기록
                    </div>
                    {Object.keys(u.lessonBest).length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>아직 푼 레슨이 없어요.</div>
                    ) : (
                      Object.entries(u.lessonBest).map(([lessonId, best]) => (
                        <div
                          key={lessonId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            padding: "3px 0",
                            color: "var(--text-2)",
                          }}
                        >
                          <span>{lessonTitleOf(lessonId)}</span>
                          <b>
                            {best.correct}/{best.total}
                          </b>
                        </div>
                      ))
                    )}
                  </div>

                  {!isMe && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <Button variant="outline" onClick={() => setConfirm({ code: u.code, kind: "reset" })}>
                        기록 초기화
                      </Button>
                      <Button
                        onClick={() => setConfirm({ code: u.code, kind: "delete" })}
                        style={{ background: "var(--danger)", color: "#fff" }}
                      >
                        계정 삭제
                      </Button>
                    </div>
                  )}
                  {isMe && (
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 12 }}>
                      내 계정이라 여기서는 지울 수 없어요.
                    </div>
                  )}

                  {confirm && confirm.code === u.code && (
                    <Card style={{ marginTop: 12, background: "var(--danger-soft)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>
                        {confirm.kind === "reset"
                          ? `${u.id} 님의 학습 기록을 지울까요?`
                          : `${u.id} 님의 계정을 지울까요?`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6 }}>
                        되돌릴 수 없어요.
                        {confirm.kind === "delete" &&
                          " 로그인 정보는 남으니 Supabase 대시보드에서 마저 정리해 주세요."}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                          취소
                        </Button>
                        <Button
                          onClick={runAction}
                          disabled={busy}
                          style={{ background: "var(--danger)", color: "#fff" }}
                        >
                          {busy ? "처리 중..." : "실행"}
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

/* ============================================================
   메일 링크로 들어왔을 때 — 새 비밀번호 설정
   ============================================================ */
function ResetPasswordScreen({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (busy) return;
    setError("");
    if (pw !== pw2) {
      setError("비밀번호가 서로 달라요.");
      return;
    }
    setBusy(true);
    try {
      const res = await completePasswordReset(pw);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="scroll-col"
      style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 20px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
    >
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 38 }}>🔑</div>
        <div style={{ fontWeight: 800, fontSize: 19, marginTop: 6 }}>새 비밀번호 정하기</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
          앞으로 쓸 비밀번호를 입력해 주세요
        </div>
      </div>

      <Notice text={error} />

      <Field
        label="새 비밀번호 (6자 이상)"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="새 비밀번호"
      />
      <Field
        label="새 비밀번호 확인"
        type="password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
        }}
        placeholder="한 번 더 입력"
      />

      <div style={{ marginTop: 6 }}>
        <Button onClick={handleSave} disabled={busy || !pw || !pw2}>
          {busy ? "저장 중..." : "비밀번호 바꾸기"}
        </Button>
      </div>
    </div>
  );
}

function AccountScreen({ account, progress, onAccountChange, onLogout, onNav, onOpenAdmin }) {
  const [panel, setPanel] = useState(null); // null | id | password
  const [newId, setNewId] = useState(account.id);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState(null); // { text, tone }
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recoveryEmail, setRecoveryEmailState] = useState(null);
  const [newEmail, setNewEmail] = useState("");

  const level = levelOf(progress.xp);

  useEffect(() => {
    let alive = true;
    (async () => {
      const mail = await getRecoveryEmail();
      if (alive) setRecoveryEmailState(mail);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleEmailSave() {
    if (busy) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await setRecoveryEmail(account.code, newEmail);
      if (res.error) {
        setMsg({ text: res.error, tone: "danger" });
        return;
      }
      setRecoveryEmailState(newEmail.trim());
      setNewEmail("");
      setPanel(null);
      setMsg({ text: "이메일을 등록했어요.", tone: "success" });
    } finally {
      setBusy(false);
    }
  }

  async function handleIdSave() {
    if (busy) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await changeId(account.code, newId);
      if (res.error) {
        setMsg({ text: res.error, tone: "danger" });
        return;
      }
      onAccountChange(res.account);
      setPanel(null);
      setMsg({ text: "아이디를 바꿨어요.", tone: "success" });
    } finally {
      setBusy(false);
    }
  }

  async function handlePwSave() {
    if (busy) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await changePassword(account.code, curPw, newPw);
      if (res.error) {
        setMsg({ text: res.error, tone: "danger" });
        return;
      }
      setCurPw("");
      setNewPw("");
      setPanel(null);
      setMsg({ text: "비밀번호를 바꿨어요.", tone: "success" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteAccount(account.code);
      onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title="마이" />
      <div style={{ flex: 1, padding: "0 18px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
        <Card style={{ marginTop: 4, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>🧑‍🔬</div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>{account.id}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
            Lv.{level} · 경험치 {progress.xp}
          </div>
        </Card>

        <Card style={{ marginTop: 10, background: "var(--primary-light)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>고유 코드</div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 1,
              color: "var(--primary)",
              margin: "6px 0 3px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {formatCode(account.code)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>
            바꿀 수 없어요. 계정을 찾을 때 쓰이니 적어두세요.
          </div>
        </Card>

        {msg && (
          <div style={{ marginTop: 10 }}>
            <Notice text={msg.text} tone={msg.tone} />
          </div>
        )}

        <Card style={{ marginTop: 10 }}>
          <div
            onClick={() => {
              setPanel(panel === "id" ? null : "id");
              setNewId(account.id);
              setMsg(null);
            }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>아이디 변경</span>
            <ChevronRight size={16} color="var(--text-3)" />
          </div>
          {panel === "id" && (
            <div style={{ marginTop: 10 }}>
              <Field
                label="새 아이디"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <Button onClick={handleIdSave} disabled={busy || !newId.trim() || newId === account.id}>
                {busy ? "처리 중..." : "저장"}
              </Button>
            </div>
          )}
        </Card>

        <Card style={{ marginTop: 10 }}>
          <div
            onClick={() => {
              setPanel(panel === "password" ? null : "password");
              setCurPw("");
              setNewPw("");
              setMsg(null);
            }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>비밀번호 변경</span>
            <ChevronRight size={16} color="var(--text-3)" />
          </div>
          {panel === "password" && (
            <div style={{ marginTop: 10 }}>
              <Field
                label="현재 비밀번호"
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
              />
              <Field
                label="새 비밀번호 (6자 이상)"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
              <Button onClick={handlePwSave} disabled={busy || !curPw || !newPw}>
                {busy ? "처리 중..." : "저장"}
              </Button>
            </div>
          )}
        </Card>

        {account.isAdmin && (
          <Card
            style={{ marginTop: 10, background: "var(--primary-light)" }}
            onClick={onOpenAdmin}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>관리자 화면</div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>
                  전체 사용자와 학습 기록 보기
                </div>
              </div>
              <ChevronRight size={16} color="var(--primary)" />
            </div>
          </Card>
        )}

        {serverMode && (
          <Card style={{ marginTop: 10 }}>
            <div
              onClick={() => {
                setPanel(panel === "email" ? null : "email");
                setNewEmail(recoveryEmail || "");
                setMsg(null);
              }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>비밀번호 찾기용 이메일</div>
                <div style={{ fontSize: 11, color: recoveryEmail ? "var(--text-3)" : "var(--danger)", marginTop: 2 }}>
                  {recoveryEmail || "등록 안 됨 — 비밀번호를 잊으면 못 찾아요"}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-3)" />
            </div>
            {panel === "email" && (
              <div style={{ marginTop: 10 }}>
                <Field
                  label="이메일"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="받을 수 있는 이메일"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <Button onClick={handleEmailSave} disabled={busy || !newEmail.trim()}>
                  {busy ? "처리 중..." : "저장"}
                </Button>
              </div>
            )}
          </Card>
        )}

        <div style={{ marginTop: 16 }}>
          <Button variant="outline" onClick={onLogout}>
            로그아웃
          </Button>
        </div>

        {!confirmDelete ? (
          <div
            onClick={() => {
              setConfirmDelete(true);
              setMsg(null);
            }}
            style={{
              marginTop: 14,
              textAlign: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--danger)",
              cursor: "pointer",
            }}
          >
            계정 삭제
          </div>
        ) : (
          <Card style={{ marginTop: 14, background: "var(--danger-soft)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>
              정말 삭제할까요?
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)", marginTop: 6 }}>
              {serverMode
                ? "학습 기록이 모두 지워지고 로그아웃돼요. 되돌릴 수 없어요. (계정 자체를 완전히 지우려면 관리자에게 요청해야 해요.)"
                : "계정과 학습 기록이 모두 사라져요. 되돌릴 수 없어요."}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
                취소
              </Button>
              <Button
                onClick={handleDelete}
                disabled={busy}
                style={{ background: "var(--danger)", color: "#fff" }}
              >
                {busy ? "삭제 중..." : "삭제"}
              </Button>
            </div>
          </Card>
        )}

        <div style={{ height: 18 }} />
      </div>
      <BottomNav active="me" onNav={onNav} />
    </div>
  );
}

export default function ScienceDuolingoApp() {
  const [account, setAccount] = useState(null);
  const [booting, setBooting] = useState(true);
  const [recovering, setRecovering] = useState(() => isRecoveryLink());
  const [screen, setScreen] = useState("home");
  const [activeSubject, setActiveSubject] = useState("physics");
  const [activeLesson, setActiveLesson] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [progress, setProgress] = useState(() => loadProgress(null));
  const [retryMode, setRetryMode] = useState(false);

  // 서버 기록과 기기 기록 중 더 많이 진행된 쪽을 쓴다
  async function resolveProgress(acc) {
    const localCopy = loadProgress(acc.code);
    if (!serverMode) return ensureDailyChallenge(localCopy, allQuestionsFlat());
    const remoteCopy = await fetchProgress();
    if (!remoteCopy) {
      await pushProgress(localCopy);
      return ensureDailyChallenge(localCopy, allQuestionsFlat());
    }
    const best = remoteCopy.xp >= localCopy.xp ? remoteCopy : localCopy;
    return ensureDailyChallenge(best, allQuestionsFlat());
  }

  // 앱을 열 때 이전 로그인 상태를 복원한다
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 메일 링크로 들어온 경우엔 새 비밀번호를 먼저 정하게 한다
        if (isRecoveryLink()) return;
        const acc = await getCurrentAccount();
        if (!alive || !acc) return;
        setAccount(acc);
        setProgress(await resolveProgress(acc));
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 기록이 바뀔 때마다 기기에 저장하고, 서버 모드면 서버로도 올린다
  useEffect(() => {
    if (!account) return;
    saveProgress(progress, account.code);
    if (serverMode) pushProgress(progress);
  }, [progress, account]);

  async function handleAuthed(acc) {
    setAccount(acc);
    setProgress(await resolveProgress(acc));
    setScreen("home");
  }

  function handleNav(tab) {
    if (tab === "home") {
      setScreen("home");
      setProgress((prev) => ensureDailyChallenge(prev, allQuestionsFlat()));
    }
    else if (tab === "me") setScreen("me");
    else if (tab === "modules") openModules("biology");
    else if (tab === "stats") setScreen("home"); // 기록 화면은 아직 준비 중
  }

  async function handleLogout() {
    await logout();
    setAccount(null);
    setProgress(loadProgress(null));
    setScreen("home");
  }

  function openModules(subjectId) {
    setActiveSubject(typeof subjectId === "string" ? subjectId : "physics");
    setScreen("modules");
  }

  function startLesson(lesson) {
    setActiveLesson(lesson);
    setRetryMode(false);
    setScreen(lesson.video ? "intro" : "quiz");
  }

  function finishLesson(result) {
    setLastResult(result);
    // 오답 다시 풀기는 기록에 반영하지 않는다 (전체 레슨을 푼 것이 아니므로)
    if (!retryMode) {
      if (activeLesson.isDaily) {
        setProgress((prev) => applyDailyChallengeResult(prev, result));
      } else {
        setProgress((prev) => applyLessonResult(prev, activeLesson.id, result));
      }
    }
    setScreen("result");
  }

  function retryWrong() {
    const wrongQuestions = activeLesson.questions.filter((q) => lastResult.wrongIds.includes(q.id));
    setActiveLesson({ ...activeLesson, questions: wrongQuestions });
    setRetryMode(true);
    setScreen("quiz");
  }

  /* 오늘의 랜덤 10 시작 — 이미 풀어본 문제 중 오늘 뽑힌 것들로 퀴즈를 연다 */
  function startDailyChallenge() {
    const dc = progress.dailyChallenge;
    if (!dc || dc.questionIds.length === 0) return;
    const byId = new Map(allQuestionsFlat().map((q) => [q.id, q]));
    const questions = dc.questionIds.map((id) => byId.get(id)).filter(Boolean);
    if (questions.length === 0) return;
    setActiveLesson({ id: `daily-${dc.date}`, title: "오늘의 랜덤 10", isDaily: true, questions });
    setRetryMode(false);
    setScreen("quiz");
  }



  return (
    <div
      style={{
        "--primary": "#6C5CE7",
        "--primary-dark": "#5B4BD6",
        "--primary-light": "#EFEDFB",
        "--primary-soft": "#F5F3FE",
        "--bg": "#F2F1F8",
        "--card": "#FFFFFF",
        "--text": "#1F2030",
        "--text-2": "#6E6E85",
        "--text-3": "#A2A2B5",
        "--line": "#ECEAF5",
        "--success": "#34C77B",
        "--success-soft": "#E5F7EE",
        "--warn": "#FF8C42",
        "--warn-soft": "#FFEFE2",
        "--danger": "#F25C75",
        "--danger-soft": "#FCE7EC",
        "--info": "#4FA8F5",
        "--info-soft": "#E5F1FD",
        display: "flex",
        justifyContent: "center",
        padding: "24px 10px",
        fontFamily:
          '"Apple SD Gothic Neo","Pretendard","Malgun Gothic","Noto Sans KR",system-ui,sans-serif',
        color: "var(--text)",
        background: "transparent",
      }}
    >
      <style>{`
        .phone-frame { height: min(720px, calc(100vh - 48px)); }
        /* 세로 flex 안의 요소는 공간이 모자라면 찌그러진다.
           그러면 넘치지 않아 스크롤이 생기지 않는다. 찌그러짐을 막는다. */
        .scroll-col > * { flex-shrink: 0; }
        /* 모바일 주소창이 차지하는 높이까지 반영되는 단위 */
        @supports (height: 100dvh) {
          .phone-frame { height: min(720px, calc(100dvh - 48px)); }
        }
      `}</style>
      <div
        className="phone-frame"
        style={{
          width: 380,
          maxWidth: "100%",
          background: "var(--bg)",
          borderRadius: 32,
          boxShadow: "0 12px 32px rgba(31,32,48,.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {booting && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-3)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            불러오는 중...
          </div>
        )}

        {!booting && recovering && (
          <ResetPasswordScreen
            onDone={async () => {
              setRecovering(false);
              await logout();
              setAccount(null);
            }}
          />
        )}

        {!booting && !recovering && !account && <AuthScreen onAuthed={handleAuthed} />}

        {!booting && !recovering && account && screen === "home" && (
          <HomeScreen
            progress={progress}
            onOpenModules={openModules}
            onNav={handleNav}
            onStartDaily={startDailyChallenge}
          />
        )}
        {!booting && !recovering && account && screen === "me" && (
          <AccountScreen
            account={account}
            progress={progress}
            onAccountChange={setAccount}
            onLogout={handleLogout}
            onNav={handleNav}
            onOpenAdmin={() => setScreen("admin")}
          />
        )}
        {!booting && !recovering && account && screen === "admin" && (
          <AdminScreen account={account} onBack={() => setScreen("me")} />
        )}
        {!booting && !recovering && account && screen === "modules" && (
          <ModulesScreen
            subjectId={activeSubject}
            onBack={() => setScreen("home")}
            onStartLesson={startLesson}
            progress={progress}
          />
        )}
        {!booting && !recovering && account && screen === "intro" && activeLesson && (
          <LessonIntroScreen
            lesson={activeLesson}
            onStart={() => setScreen("quiz")}
            onBack={() => setScreen("modules")}
          />
        )}
        {!booting && !recovering && account && screen === "quiz" && activeLesson && (
          <QuizScreen
            lesson={activeLesson}
            onExit={() =>
              setScreen(
                activeLesson.isDaily ? "home" : activeLesson.video && !retryMode ? "intro" : "modules"
              )
            }
            onFinish={finishLesson}
          />
        )}
        {!booting && !recovering && account && screen === "result" && lastResult && activeLesson && (
          <ResultScreen
            result={lastResult}
            lesson={activeLesson}
            onBackToModules={() => setScreen(activeLesson.isDaily ? "home" : "modules")}
            onRetryWrong={retryWrong}
          />
        )}
      </div>
    </div>
  );
}
