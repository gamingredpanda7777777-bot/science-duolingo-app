/* ============================================================
   문제 점검 도구 (커리큘럼 자동화 1단계)

   실행:  node tools/check-questions.mjs

   src/data/subjects.js 에 등록된 모든 문제를 검사한다.
   - id 중복, 문제·해설 누락
   - 4지선다 / 5지선다: 선택지 개수와 정답 번호 범위
   - ㄱㄴㄷ 문제: 보기 3개, 정답 선택지 존재
   - 단답형: 정답 목록 존재
   문제가 하나라도 있으면 종료 코드 1로 끝나서, 깃에 올리기 전에 막아 준다.
   ============================================================ */

import { SUBJECTS } from "../src/data/subjects.js";

const DIFFICULTIES = new Set(["easy", "medium", "hard", "synthesis"]);
const errors = [];
const seenIds = new Set();
let total = 0;

for (const subject of SUBJECTS) {
  for (const mod of subject.modules) {
    for (const lesson of mod.lessons) {
      if (!lesson.questions) continue;
      let count = 0;
      for (const q of lesson.questions) {
        count += 1;
        total += 1;
        const where = `[${lesson.id}] ${q.id ?? "(id 없음)"}`;
        const fail = (msg) => errors.push(`${where}: ${msg}`);

        if (!q.id) fail("id 가 없어요");
        else if (seenIds.has(q.id)) fail("id 가 중복돼요");
        seenIds.add(q.id);

        if (!q.stem || !String(q.stem).trim()) fail("문제(stem)가 비어 있어요");
        if (!q.explanation || !String(q.explanation).trim()) fail("해설(explanation)이 비어 있어요");
        if (q.difficulty && !DIFFICULTIES.has(q.difficulty)) fail(`difficulty 값이 이상해요: ${q.difficulty}`);

        if (q.type === "short_answer") {
          if (!Array.isArray(q.answers) || q.answers.length === 0) fail("단답형인데 answers 가 없어요");
          continue;
        }

        if (!Array.isArray(q.choices) || q.choices.length < 4 || q.choices.length > 5) {
          fail(`선택지는 4~5개여야 해요 (지금 ${q.choices?.length ?? 0}개)`);
          continue;
        }
        if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.choices.length) {
          fail(`answerIndex(${q.answerIndex})가 선택지 범위를 벗어나요`);
        }
        if (q.format === "gnd") {
          if (!Array.isArray(q.boxItems) || q.boxItems.length !== 3) fail("ㄱㄴㄷ 문제는 보기가 3개여야 해요");
        }
        if (new Set(q.choices).size !== q.choices.length) fail("같은 선택지가 두 번 있어요");
      }
      console.log(`${String(count).padStart(3)}문제  ${lesson.title}  (${lesson.id})`);
    }
  }
}

console.log(`\n전체 ${total}문제 · 오류 ${errors.length}개`);
if (errors.length) {
  console.log("\n--- 오류 목록 ---");
  for (const e of errors) console.log(e);
  process.exit(1);
}
console.log("모든 문제가 규칙을 통과했어요.");
