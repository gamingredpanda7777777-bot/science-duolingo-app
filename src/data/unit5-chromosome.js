/* 생명과학 5단원 — 세포 분열과 발생
   1-2 염색체 수가 유지되는 세포 분열 (10문제) — 비상 중3 과학교과서 기반 */

export const UNIT5_CHROMOSOME_QUESTIONS = [
  {
    id: "std_bio_cell_a_lo2_q01",
    difficulty: "easy",
    stem: "분열 중인 세포에서 핵이 사라지고 막대 모양으로 나타나는 것은?",
    choices: ["핵", "염색체", "세포막", "리보솜"],
    answerIndex: 1,
    explanation:
      "분열 중인 세포에서는 핵 속의 유전 물질이 꼬이고 뭉쳐서 막대 모양의 염색체가 나타나요.",
  },
  {
    id: "std_bio_cell_a_lo2_q02",
    difficulty: "easy",
    type: "short_answer",
    stem: "염색체를 구성하는 유전 물질은 무엇인가? (영문 약자로 답하세요)",
    answers: ["DNA", "디엔에이", "디앤에이"],
    explanation:
      "염색체는 DNA라는 유전 물질로 이루어져 있어요. DNA에는 생물의 특징에 대한 유전 정보가 담겨 있어요.",
  },
  {
    id: "std_bio_cell_a_lo2_q03",
    difficulty: "easy",
    stem: "DNA에 담겨 있는, 생물의 특징을 결정하는 각각의 유전 정보를 무엇이라고 하는가?",
    choices: ["염색 분체", "유전자", "체세포", "세포 주기"],
    answerIndex: 1,
    explanation:
      "DNA에 담긴 여러 유전 정보 하나하나를 유전자라고 해요. 염색 분체는 염색체의 한 가닥이에요.",
  },
  {
    id: "std_bio_cell_a_lo2_q04",
    difficulty: "medium",
    type: "short_answer",
    stem: "염색체의 두 가닥을 각각 무엇이라고 하는가?",
    answers: ["염색 분체", "염색분체"],
    explanation:
      "염색체는 두 개의 가닥으로 이루어져 있고, 각각의 가닥을 염색 분체라고 해요.",
  },
  {
    id: "std_bio_cell_a_lo2_q05",
    difficulty: "medium",
    stem: "체세포 분열 전에 DNA가 복제되어 만들어진 두 염색 분체의 유전 정보는 어떠한가?",
    choices: [
      "서로 같다.",
      "서로 다르다.",
      "하나에만 유전 정보가 있다.",
      "둘 다 유전 정보가 없다.",
    ],
    answerIndex: 0,
    explanation:
      "두 염색 분체는 한쪽의 DNA가 복제되어 만들어진 것이므로 서로 같은 유전 정보를 담고 있어요.",
  },
  {
    id: "std_bio_cell_a_lo2_q06",
    difficulty: "medium",
    format: "gnd",
    stem: "체세포 분열에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
    boxItems: [
      "체세포 한 개가 두 개로 나누어지는 것이다.",
      "딸세포는 모세포와 유전 정보, 염색체의 수와 모양이 같다.",
      "딸세포는 모세포와 유전 정보가 서로 다르다.",
    ],
    choices: ["ㄱ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ", "ㄷ"],
    answerIndex: 1,
    explanation:
      "체세포 분열은 체세포 한 개가 두 개로 나누어지는 것이고(ㄱ), 만들어진 딸세포는 모세포와 유전 정보, 염색체 수와 모양이 같아요(ㄴ). 딸세포의 유전 정보는 모세포와 같으므로 ㄷ은 틀렸어요.",
  },
  {
    id: "std_bio_cell_a_lo2_q07",
    difficulty: "medium",
    stem: "체세포 분열이 일어나기 전, 모세포의 핵 속에서 염색체가 실처럼 풀어진 상태일 때 일어나는 일은?",
    choices: ["DNA 복제", "세포막 소실", "물질 교환 중단", "핵의 분열"],
    answerIndex: 0,
    explanation:
      "체세포 분열이 일어나기 전에 염색체가 실처럼 풀어진 상태에서 DNA가 복제돼요. 그래서 염색 분체가 두 개씩 만들어져요.",
  },
  {
    id: "std_bio_cell_a_lo2_q08",
    difficulty: "medium",
    type: "short_answer",
    stem: "양파 뿌리 끝에서 체세포 분열이 활발하게 일어나는 부위를 무엇이라고 하는가?",
    answers: ["생장점"],
    explanation:
      "양파 뿌리 끝에는 체세포 분열이 활발하게 일어나는 생장점이 있어서, 체세포 분열 단계를 관찰하기 좋아요.",
  },
  {
    id: "std_bio_cell_a_lo2_q09",
    difficulty: "hard",
    stem: "모세포 한 개가 체세포 분열을 하면 딸세포 두 개가 만들어진다. 이 딸세포들의 염색체 수는 모세포와 비교하면 어떠한가?",
    choices: [
      "모세포와 같다.",
      "모세포의 절반이다.",
      "모세포의 두 배이다.",
      "모세포와 같을 때도 있고 다를 때도 있다.",
    ],
    answerIndex: 0,
    explanation:
      "체세포 분열로 만들어진 딸세포는 모세포와 염색체의 수와 모양이 같아요. 그래서 체세포 분열을 해도 염색체 수는 유지돼요.",
  },
  {
    id: "std_bio_cell_a_lo2_q10",
    difficulty: "synthesis",
    stem: "염색체, DNA, 유전자의 관계를 옳게 나타낸 것은?",
    choices: [
      "유전자는 DNA에 담긴 유전 정보의 단위이다.",
      "DNA는 유전자 안에 들어 있는 물질이다.",
      "염색체는 유전자 안에 들어 있다.",
      "유전자는 염색체 밖에서만 존재한다.",
    ],
    answerIndex: 0,
    explanation:
      "염색체는 DNA로 이루어져 있고, DNA에 담긴 여러 유전 정보 하나하나가 유전자예요. 그러므로 유전자는 DNA의 유전 정보 단위예요.",
  },
];
