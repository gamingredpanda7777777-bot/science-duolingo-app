import React, { useState, useEffect, useMemo } from "react";
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
  Car,
  Shuffle,
  Trophy,
  Sparkles,
  Frown,
  Medal,
  Mail,
  Key,
  Microscope,
  Play,
} from "lucide-react";
import { SUBJECTS, allQuestionsFlat } from "./data/subjects.js";
import {
  loadProgress,
  saveProgress,
  applyLessonResult,
  levelOf,
  xpIntoLevel,
  ensureDailyChallenge,
  applyDailyChallengeResult,
  DAILY_MIN_SOLVED,
} from "./lib/progress.js";
import {
  serverMode,
  getCurrentAccount,
  createAccount,
  login,
  logout,
  changeId,
  changePassword,
  deleteAccount,
  requestPasswordReset,
  isRecoveryLink,
  completePasswordReset,
  getRecoveryEmail,
  setRecoveryEmail,
  fetchAllUsers,
  adminResetProgress,
  adminDeleteUser,
  fetchProgress,
  pushProgress,
  signInWithGoogle,
  fetchLeaderboard,
  formatCode,
} from "./lib/accounts.js";

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

const TAB_SCREENS = ["home", "modules", "stats", "me", "admin"];
const SUBJECT_ICONS = { car: Car, dna: Dna };

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
        padding: "8px 4px calc(12px + env(safe-area-inset-bottom, 0px))",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
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
          <Shuffle size={22} strokeWidth={2} color="var(--primary)" style={{ flexShrink: 0 }} />
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
          <Check size={22} strokeWidth={2} color="var(--success)" style={{ flexShrink: 0 }} />
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
        <Shuffle size={22} strokeWidth={2} color="var(--primary)" style={{ flexShrink: 0 }} />
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
      <div style={{ fontWeight: 700, fontSize: 18 }}>안녕하세요!</div>
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
          <Trophy size={20} strokeWidth={2} color="var(--primary)" />
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
              {(() => {
                const SubjIcon = SUBJECT_ICONS[subj.icon] || Beaker;
                return <SubjIcon size={20} strokeWidth={2} color={subj.color} />;
              })()}
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
    .replace(/[.,!?·'"():\-]/g, "")
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
              <div>{isCorrect ? <Sparkles size={44} strokeWidth={1.8} color="var(--success)" /> : <Frown size={44} strokeWidth={1.8} color="var(--danger)" />}</div>
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
        <div><Medal size={56} strokeWidth={1.8} color="var(--primary)" /></div>
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
            <TrendingUp size={13} strokeWidth={2.4} style={{ verticalAlign: "-2px", marginRight: 4 }} />{scorePct}%
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
              <Check size={14} strokeWidth={3} />
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
              <X size={14} strokeWidth={3} />
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

function AuthScreen({ onAuthed, onBack }) {
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

  async function handleGoogle() {
    setError("");
    const res = await signInWithGoogle();
    if (res.error) setError(res.error);
  }

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
          <div><Mail size={40} strokeWidth={1.8} color="var(--primary)" /></div>
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
          <div><Sparkles size={44} strokeWidth={1.8} color="var(--success)" /></div>
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
      {onBack && (
        <div style={{ marginBottom: 6 }}>
          <div
            onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, color: "var(--text-2)", cursor: "pointer" }}
          >
            <ChevronLeft size={16} /> 처음으로
          </div>
        </div>
      )}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <Beaker size={38} strokeWidth={1.8} color="var(--primary)" />
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

          {mode !== "forgot" && (
            <div style={{ marginTop: 10 }}>
              <Button variant="outline" onClick={handleGoogle} disabled={busy || !serverMode}>
                Google로 계속하기{serverMode ? "" : " (서버 연결 필요)"}
              </Button>
            </div>
          )}

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
        <div><Key size={38} strokeWidth={1.8} color="var(--primary)" /></div>
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
      if (res.pending) {
        setPanel(null);
        setMsg({
          text: `${newEmail.trim()} 로 확인 메일을 보냈어요. 메일의 링크를 눌러야 등록이 끝나요. 메일이 오지 않으면 스팸함을 확인해 주세요.`,
          tone: "success",
        });
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
          <div><Microscope size={32} strokeWidth={1.8} color="var(--primary)" /></div>
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
    </div>
  );
}

/* ============================================================
   랜딩 · 둘러보기 · 기록 화면
   ============================================================ */

/* 구글 로그인 등에서 실패하면 주소 뒤에 error_description 이 붙어서 돌아온다.
   읽어서 화면에 보여주고, 주소창은 깨끗하게 지운다. */
function readAuthErrorFromUrl() {
  try {
    const params = new URLSearchParams(
      (window.location.hash || "").replace(/^#/, "") + "&" + (window.location.search || "").replace(/^\?/, "")
    );
    const desc = params.get("error_description") || params.get("error");
    if (!desc) return "";
    window.history.replaceState(null, "", window.location.pathname);
    return `로그인에 실패했어요: ${desc.replace(/\+/g, " ")}`;
  } catch {
    return "";
  }
}

function LandingScreen({ notice, onLogin, onGuest }) {
  const demo = useMemo(
    () =>
      allQuestionsFlat().find(
        (q) => Array.isArray(q.choices) && q.choices.length === 4 && q.difficulty === "easy"
      ),
    []
  );
  const [picked, setPicked] = useState(null);
  const features = [
    { icon: Play, title: "개념 영상", text: "핵심 개념을 영상으로 먼저 봐요." },
    { icon: Shuffle, title: "오늘의 랜덤 10", text: "매일 섞인 문제 10개로 복습해요." },
    { icon: Trophy, title: "레벨과 랭킹", text: "풀수록 경험치가 쌓이고 순위가 올라가요." },
  ];

  return (
    <div
      className="scroll-col"
      style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 20px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
    >
      <Notice text={notice} />
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <Beaker size={40} strokeWidth={1.8} color="var(--primary)" />
        <div style={{ fontWeight: 800, fontSize: 22, marginTop: 8 }}>과학 학습 프로그램</div>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>문제를 풀면서 개념을 다져요</div>
      </div>

      {demo && (
        <Card style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>체험 문제</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{demo.stem}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {demo.choices.map((c, i) => {
              const isAnswer = i === demo.answerIndex;
              const tone = picked === null ? null : isAnswer ? "ok" : picked === i ? "bad" : null;
              const border = tone === "ok" ? "var(--success)" : tone === "bad" ? "var(--danger)" : "var(--line)";
              const bg = tone === "ok" ? "var(--success-soft)" : tone === "bad" ? "var(--danger-soft)" : "#fff";
              return (
                <button
                  key={i}
                  disabled={picked !== null}
                  onClick={() => setPicked(i)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1.5px solid ${border}`,
                    background: bg,
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--text)",
                    cursor: picked === null ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ flex: 1 }}>{c}</span>
                  {tone === "ok" && <Check size={16} color="var(--success)" strokeWidth={3} />}
                  {tone === "bad" && <X size={16} color="var(--danger)" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>{demo.explanation}</div>
          )}
        </Card>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.title}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{ width: 38, height: 38, borderRadius: 12, background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <Icon size={18} color="var(--primary)" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{f.text}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <Button onClick={onLogin}>로그인 · 회원가입</Button>
        <Button variant="outline" onClick={onGuest}>로그인 없이 둘러보기</Button>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 8, marginBottom: 20 }}>
        둘러보기 기록은 이 기기에만 저장돼요.
      </div>
    </div>
  );
}

function GuestPanel({ onLogin }) {
  return (
    <div
      className="scroll-col"
      style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 20px", overflowY: "auto", minHeight: 0 }}
    >
      <Card style={{ textAlign: "center" }}>
        <User size={34} color="var(--primary)" strokeWidth={1.8} />
        <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8 }}>둘러보는 중이에요</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6 }}>
          기록은 이 기기에만 저장돼요. 로그인하면 기기를 바꿔도 기록이 이어져요.
        </div>
      </Card>
      <div style={{ marginTop: 16 }}>
        <Button onClick={onLogin}>로그인 · 회원가입</Button>
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{ flex: 1, background: "var(--card)", borderRadius: 16, padding: "12px 8px", textAlign: "center", border: "1px solid var(--line)" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function StatsScreen({ progress }) {
  const [board, setBoard] = useState(null);
  const [boardError, setBoardError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchLeaderboard().then((res) => {
      if (!alive) return;
      if (res.error) setBoardError(res.error);
      else setBoard(res.rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const level = levelOf(progress.xp);
  const into = xpIntoLevel(progress.xp);
  const stats = Object.values(progress.questionStats || {});
  const attempts = stats.reduce((sum, s) => sum + (s.attempts || 0), 0);
  const wrong = stats.reduce((sum, s) => sum + (s.wrongCount || 0), 0);
  const accuracy = attempts ? Math.round(((attempts - wrong) / attempts) * 100) : 0;

  return (
    <div
      className="scroll-col"
      style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 18px 0", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
    >
      <div style={{ fontWeight: 800, fontSize: 18 }}>내 기록</div>

      <Card style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontWeight: 800, fontSize: 22, color: "var(--primary)" }}>Lv.{level}</span>
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>
            {progress.xp} XP · 다음 레벨까지 {100 - into} XP
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <ProgressBar pct={into} />
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <StatTile label="완료한 레슨" value={progress.completedLessons.length} />
        <StatTile label="정답률" value={`${accuracy}%`} />
        <StatTile label="연속 학습" value={`${progress.streak}일`} />
      </div>

      <Card style={{ marginTop: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Medal size={16} color="var(--primary)" /> 랭킹
        </div>
        {boardError && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{boardError}</div>}
        {!boardError && !board && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>불러오는 중...</div>}
        {board && board.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>아직 기록이 없어요.</div>}
        {board &&
          board.map((r, i) => (
            <div
              key={`${r.username}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                borderTop: "1px solid var(--line)",
                fontSize: 13,
                fontWeight: r.isMe ? 800 : 500,
                color: r.isMe ? "var(--primary)" : "var(--text)",
              }}
            >
              <span>
                {i + 1}. {r.username}
                {r.isMe ? " (나)" : ""}
              </span>
              <span style={{ fontSize: 12 }}>{r.xp} XP</span>
            </div>
          ))}
      </Card>
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
  const [showAuth, setShowAuth] = useState(false);
  const [bootNotice, setBootNotice] = useState("");

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
        const urlError = readAuthErrorFromUrl();
        if (urlError && alive) setBootNotice(urlError);
        const acc = await getCurrentAccount();
        if (!alive || !acc) return;
        setAccount(acc);
        setProgress(await resolveProgress(acc));
      } catch (err) {
        if (alive) setBootNotice(err?.message || "로그인 정보를 불러오지 못했어요.");
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
    if (serverMode && !account.guest) pushProgress(progress);
  }, [progress, account]);

  async function handleAuthed(acc) {
    setAccount(acc);
    setProgress(await resolveProgress(acc));
    setShowAuth(false);
    setScreen("home");
  }

  /* 로그인 없이 둘러보기: 기록은 이 기기에만 "GUEST" 이름으로 남는다 */
  function startGuest() {
    setAccount({ code: "GUEST", id: "게스트", createdAt: null, isAdmin: false, guest: true });
    setProgress(loadProgress("GUEST"));
    setScreen("home");
  }

  function handleNav(tab) {
    if (tab === "home") {
      setScreen("home");
      setProgress((prev) => ensureDailyChallenge(prev, allQuestionsFlat()));
    }
    else if (tab === "me") setScreen("me");
    else if (tab === "modules") openModules("biology");
    else if (tab === "stats") setScreen("stats");
  }

  async function handleLogout() {
    await logout();
    setShowAuth(false);
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
      className="app-shell"
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
        fontFamily:
          '"Apple SD Gothic Neo","Pretendard","Malgun Gothic","Noto Sans KR",system-ui,sans-serif',
        color: "var(--text)",
        background: "transparent",
      }}
    >
      <style>{`
        /* ---- 화면 비율에 따라 바뀌는 크기 ----
           --gap: 바깥 여백. 화면이 작을수록 줄어든다. */
        .app-shell {
          --gap: clamp(0px, 2.5vh, 24px);
          box-sizing: border-box;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: var(--gap) clamp(0px, 3vw, 24px);
        }
        /* 기본(세로로 긴 데스크톱·태블릿): 폰 폭의 단일 열 */
        .phone-frame {
          box-sizing: border-box;
          width: min(440px, 100%);
          height: min(900px, calc(100vh - 2 * var(--gap)));
        }
        @supports (height: 100dvh) {
          .phone-frame { height: min(900px, calc(100dvh - 2 * var(--gap))); }
        }
        /* 가로로 누운 화면(폰 가로, 노트북의 낮은 창): 세로 여백을 없애고 폭을 넓힌다 */
        @media (orientation: landscape) and (max-height: 620px) {
          .app-shell { --gap: 0px; padding: 0; }
          .phone-frame { width: min(720px, 100%); height: 100vh; height: 100dvh; }
        }
        /* 폰 세로 화면: 테두리와 여백 없이 전체 화면 */
        @media (max-width: 480px) {
          .app-shell { padding: 0; }
          .phone-frame { width: 100%; height: 100vh; height: 100dvh; }
        }
        /* 매우 넓은 화면: 본문 폭은 유지하고 배경 여백만 넓힌다 */
        @media (min-width: 1200px) {
          .phone-frame { width: 460px; }
        }
        /* 세로 flex 안의 요소는 공간이 모자라면 찌그러진다. 찌그러짐을 막는다. */
        .scroll-col > * { flex-shrink: 0; }
        /* 스크롤바: 얇고 연한 기본 디자인으로 교체 */
        .scroll-col { scrollbar-width: thin; scrollbar-color: #cfd3e6 transparent; }
        .scroll-col::-webkit-scrollbar { width: 6px; }
        .scroll-col::-webkit-scrollbar-track { background: transparent; }
        .scroll-col::-webkit-scrollbar-thumb { background: #cfd3e6; border-radius: 999px; }
        .scroll-col::-webkit-scrollbar-thumb:hover { background: #aab0cf; }
      `}</style>
      <div
        className="phone-frame"
        style={{
          background: "var(--bg)",
          borderRadius: 0,
          boxShadow: "none",
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

        {!booting && !recovering && !account && !showAuth && (
          <LandingScreen notice={bootNotice} onLogin={() => setShowAuth(true)} onGuest={startGuest} />
        )}
        {!booting && !recovering && !account && showAuth && (
          <AuthScreen onAuthed={handleAuthed} onBack={() => setShowAuth(false)} />
        )}

        {!booting && !recovering && account && screen === "home" && (
          <HomeScreen
            progress={progress}
            onOpenModules={openModules}
            onNav={handleNav}
            onStartDaily={startDailyChallenge}
          />
        )}
        {!booting && !recovering && account && account.guest && screen === "me" && (
          <GuestPanel
            onLogin={async () => {
              await logout();
              setAccount(null);
              setShowAuth(true);
            }}
          />
        )}
        {!booting && !recovering && account && screen === "stats" && (
          <StatsScreen progress={progress} />
        )}
        {!booting && !recovering && account && !account.guest && screen === "me" && (
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
        {!booting && !recovering && account && TAB_SCREENS.includes(screen) && (
          <BottomNav
            active={screen === "modules" ? "modules" : screen === "stats" ? "stats" : screen === "me" || screen === "admin" ? "me" : "home"}
            onNav={handleNav}
          />
        )}
      </div>
    </div>
  );
}
