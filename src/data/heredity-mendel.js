/* 생명과학 — 유전
   멘델이 밝힌 유전 원리(1) (10문제) — 비상 중3 과학교과서 기반 */

export const HEREDITY_MENDEL_QUESTIONS = [
  {
    id: "std_bio_hered_a_lo1_q01",
    difficulty: "easy",
    type: "short_answer",
    stem: "부모의 형질이 자녀에게 전달되는 현상을 무엇이라고 하는가?",
    answers: ["유전"],
    explanation:
      "생물이 지니고 있는 여러 가지 특성을 형질이라 하고, 부모의 형질이 자녀에게 전달되는 현상을 유전이라고 해요.",
  },
  {
    id: "std_bio_hered_a_lo1_q02",
    difficulty: "easy",
    stem: "멘델이 완두를 유전 실험 재료로 사용한 까닭으로 옳지 않은 것은?",
    choices: [
      "기르기 쉽다.",
      "한 세대가 짧다.",
      "자손의 수가 많다.",
      "대립 형질이 뚜렷하지 않다.",
    ],
    answerIndex: 3,
    explanation:
      "완두는 기르기 쉽고, 한 세대가 짧고, 자손의 수가 많고, 대립 형질이 뚜렷해서 실험 재료로 적합했어요.",
  },
  {
    id: "std_bio_hered_a_lo1_q03",
    difficulty: "medium",
    stem: "한 가지 형질에 대해 서로 다른 순종 개체를 교배했을 때 자손 1대에서 나타나는 형질을 무엇이라고 하는가?",
    choices: ["열성", "우성", "중간 형질", "유전 형질"],
    answerIndex: 1,
    explanation:
      "자손 1대에서 나타나는 형질을 우성이라고 해요. 자손 1대에서 나타나지 않는 형질은 열성이에요.",
  },
  {
    id: "std_bio_hered_a_lo1_q04",
    difficulty: "medium",
    type: "short_answer",
    stem: "서로 다른 순종 개체를 교배했을 때 자손 1대에서 나타나지 않는 형질을 무엇이라고 하는가?",
    answers: ["열성"],
    explanation:
      "자손 1대에서 나타나지 않는 형질을 열성이라고 해요. 이때 자손 1대에서 나타나는 형질은 우성이에요.",
  },
  {
    id: "std_bio_hered_a_lo1_q05",
    difficulty: "medium",
    stem: "씨의 색깔이 노란색인 순종 완두와 초록색인 순종 완두를 교배했을 때, 자손 1대의 씨 색깔은?",
    choices: [
      "노란색만 나온다.",
      "초록색만 나온다.",
      "노란색과 초록색이 1 : 1로 나온다.",
      "노란색과 초록색이 3 : 1로 나온다.",
    ],
    answerIndex: 0,
    explanation:
      "자손 1대에서는 노란색 씨만 나왔어요. 노란색이 우성 형질이고 초록색이 열성 형질이에요.",
  },
  {
    id: "std_bio_hered_a_lo1_q06",
    difficulty: "medium",
    format: "gnd",
    stem: "멘델의 가설에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "생물에는 한 가지 형질을 결정하는 한 쌍의 유전 인자가 있다.",
      "한 쌍의 유전 인자가 서로 다를 때 두 인자 모두 형질로 표현된다.",
      "한 쌍의 유전 인자는 생식세포가 만들어질 때 나뉘어 각 생식세포에 들어간다.",
    ],
    choices: ["ㄱ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄷ", "ㄱ, ㄴ, ㄷ"],
    answerIndex: 3,
    explanation:
      "한 가지 형질을 결정하는 한 쌍의 유전 인자가 있고(ㄱ), 생식세포가 만들어질 때 나뉘어 들어가요(ㄷ). 한 쌍의 인자가 서로 다를 때는 하나의 인자만 형질로 표현되므로 ㄴ은 틀렸어요.",
  },
  {
    id: "std_bio_hered_a_lo1_q07",
    difficulty: "medium",
    stem: "자손 1대를 자가 수분하여 얻은 자손 2대에서 노란색 완두와 초록색 완두가 나타나는 비는?",
    choices: ["1 : 1", "3 : 1", "1 : 2 : 1", "2 : 1"],
    answerIndex: 1,
    explanation:
      "자손 2대에서 노란색 완두와 초록색 완두는 약 3 : 1의 비로 나타나요.",
  },
  {
    id: "std_bio_hered_a_lo1_q08",
    difficulty: "medium",
    type: "short_answer",
    stem: "쌍을 이루고 있던 대립 유전자가 감수 분열 때 분리되어 서로 다른 생식세포로 들어가는 유전 원리를 무엇이라고 하는가?",
    answers: ["분리의 법칙", "분리법칙"],
    explanation:
      "쌍을 이루고 있던 대립 유전자가 감수 분열 때 분리되어 서로 다른 생식세포로 들어가는 것을 분리의 법칙이라고 해요.",
  },
  {
    id: "std_bio_hered_a_lo1_q09",
    difficulty: "hard",
    stem: "자손 2대에서 유전자형의 비가 YY : Yy : yy = 1 : 2 : 1로 나타날 때, 유전자형이 Yy인 완두의 씨 색깔은?",
    choices: [
      "노란색으로 나타난다.",
      "초록색으로 나타난다.",
      "노란색과 초록색이 섞인 색으로 나타난다.",
      "씨 색깔이 나타나지 않는다.",
    ],
    answerIndex: 0,
    explanation:
      "노란색 유전자 Y가 우성이므로, Yy인 완두는 노란색으로 나타나요. 그래서 표현형의 비는 노란색 : 초록색 = 3 : 1이 돼요.",
  },
  {
    id: "std_bio_hered_a_lo1_q10",
    difficulty: "synthesis",
    stem: "자손 1대의 완두(Yy)가 생식세포를 만들 때 생식세포의 유전자 종류에 대한 설명으로 옳은 것은?",
    choices: [
      "Y를 가진 생식세포와 y를 가진 생식세포가 각각 만들어진다.",
      "YY를 가진 생식세포만 만들어진다.",
      "yy를 가진 생식세포만 만들어진다.",
      "Yy를 가진 생식세포 한 종류만 만들어진다.",
    ],
    answerIndex: 0,
    explanation:
      "감수 분열 때 대립 유전자 Y와 y가 분리되어 서로 다른 생식세포로 들어가므로, Y를 가진 생식세포와 y를 가진 생식세포가 만들어져요.",
  },
];
