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
export function todayKey(d = new Date()) {
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

export function loadProgress(code) {
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

export function saveProgress(progress, code) {
  try {
    localStorage.setItem(keyFor(code), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function resetProgress(code) {
  try {
    localStorage.removeItem(keyFor(code));
  } catch {
    /* 무시 */
  }
  return { ...EMPTY };
}

/* 레벨: 경험치 100마다 1레벨 */
export function levelOf(xp) {
  return Math.floor(xp / 100) + 1;
}
export function xpIntoLevel(xp) {
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
export function applyLessonResult(progress, lessonId, result) {
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
export const DAILY_MIN_SOLVED = 5;

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
export function pickDailyQuestionIds(progress, allQuestions) {
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
export function ensureDailyChallenge(progress, allQuestions) {
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
export function applyDailyChallengeResult(progress, result) {
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
