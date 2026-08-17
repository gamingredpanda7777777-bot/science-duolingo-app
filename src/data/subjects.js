/* 과목 → 모듈 → 레슨 구조. 새 문제 세트는 여기에 등록한다. */

import { MOTION_LESSON_QUESTIONS } from "./physics.js";
import { EYE_QUESTIONS, EAR_QUESTIONS, SKIN_QUESTIONS, TASTE_SMELL_QUESTIONS } from "./unit4-sense.js";
import { NERVOUS_SYSTEM_QUESTIONS, NEURON_QUESTIONS, REFLEX_QUESTIONS } from "./unit4-nerve.js";
import { HORMONE_QUESTIONS, BODY_REGULATION_QUESTIONS } from "./unit4-homeostasis.js";
import { SHORT_ANSWER_QUESTIONS, ADVANCED_QUESTIONS } from "./unit4-advanced.js";

/* ============================================================
   과목 / 모듈 / 레슨 구조
   생명과학 문제를 더 추가할 때는 아래 lessons 배열에
   { id, title, status: "available", questions: [...] } 형태로 넣으면 돼요.
   ============================================================ */
export const SUBJECTS = [
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
