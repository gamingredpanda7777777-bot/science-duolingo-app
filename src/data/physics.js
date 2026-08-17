/* 물리 — 운동과 에너지 문제 */

export const MOTION_LESSON_QUESTIONS = [
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
