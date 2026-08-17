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

/* 레슨을 끝냈을 때 기록을 갱신한 새 객체를 돌려준다 */
export function applyLessonResult(progress, lessonId, correctCount, total) {
  const today = todayKey();

  // 연속 학습일 계산
  let streak = progress.streak || 0;
  if (progress.lastStudyDate === today) {
    // 오늘 이미 학습함 → 그대로
    streak = streak || 1;
  } else if (progress.lastStudyDate && daysBetween(progress.lastStudyDate, today) === 1) {
    streak = streak + 1; // 어제도 했음 → 이어짐
  } else {
    streak = 1; // 처음이거나 하루 이상 건너뜀 → 새로 시작
  }

  // 최고 기록만 갱신
  const prevBest = progress.lessonBest[lessonId];
  const lessonBest = { ...progress.lessonBest };
  if (!prevBest || correctCount > prevBest.correct) {
    lessonBest[lessonId] = { correct: correctCount, total };
  }

  return {
    ...progress,
    xp: (progress.xp || 0) + correctCount * 10,
    completedLessons: progress.completedLessons.includes(lessonId)
      ? progress.completedLessons
      : [...progress.completedLessons, lessonId],
    lessonBest,
    streak,
    lastStudyDate: today,
  };
}
