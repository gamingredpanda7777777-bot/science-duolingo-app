/* ============================================================
   새 레슨 추가 도구 (커리큘럼 자동화 2단계)

   실행:  node tools/new-lesson.mjs 명세파일.json

   명세 파일 예시 (tools/lesson-spec.example.json 참고):
   {
     "module": "heredity",                 // 이미 있는 모듈 id
     "lessonId": "std_bio_hered_d_lesson", // 레슨 id (고유)
     "title": "레슨 이름",
     "exportName": "HEREDITY_D_QUESTIONS", // 자바스크립트 변수 이름
     "fileName": "heredity-d.js",          // src/data/ 아래에 만들 파일
     "questions": [ ...문제 객체들... ]
   }

   하는 일
   1) src/data/<fileName> 파일을 만들고 문제를 넣는다.
   2) src/data/subjects.js 에 import 와 레슨 등록을 자동으로 넣는다.
   3) tools/check-questions.mjs 로 전체를 점검한다.
      실패하면 원래 상태로 되돌리고 오류를 보여준다.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const subjectsPath = resolve(root, "src/data/subjects.js");

const specPath = process.argv[2];
if (!specPath) {
  console.error("사용법: node tools/new-lesson.mjs 명세파일.json");
  process.exit(1);
}
const spec = JSON.parse(readFileSync(resolve(process.cwd(), specPath), "utf8"));
for (const key of ["module", "lessonId", "title", "exportName", "fileName", "questions"]) {
  if (!(key in spec)) throw new Error(`명세에 "${key}" 가 없어요`);
}
if (!/^[A-Z][A-Z0-9_]*$/.test(spec.exportName)) throw new Error("exportName 은 대문자와 _ 로 써 주세요");
if (!/^[a-z0-9-]+\.js$/.test(spec.fileName)) throw new Error("fileName 은 소문자·숫자·- 로 된 .js 이름이어야 해요");

const dataPath = resolve(root, "src/data", spec.fileName);
if (existsSync(dataPath)) throw new Error(`이미 있는 파일이에요: src/data/${spec.fileName}`);

const original = readFileSync(subjectsPath, "utf8");
if (original.includes(`id: "${spec.lessonId}"`)) throw new Error(`이미 있는 레슨 id 예요: ${spec.lessonId}`);

// 1) 모듈 찾기: id 다음에 나오는 lessons 배열의 닫는 괄호 위치를 찾는다
const modMatch = original.indexOf(`id: "${spec.module}",`);
if (modMatch < 0) throw new Error(`모듈 "${spec.module}" 을 subjects.js 에서 찾지 못했어요. 먼저 모듈을 만들어 주세요.`);
const lessonsStart = original.indexOf("lessons: [", modMatch);
const lessonsEnd = original.indexOf("\n        ],", lessonsStart);
if (lessonsStart < 0 || lessonsEnd < 0) throw new Error("모듈의 lessons 배열을 찾지 못했어요.");

const lessonEntry =
  `          {\n` +
  `            id: "${spec.lessonId}",\n` +
  `            title: ${JSON.stringify(spec.title)},\n` +
  `            status: "available",\n` +
  `            questions: ${spec.exportName},\n` +
  `          },`;

let updated = original.slice(0, lessonsEnd) + "\n" + lessonEntry + original.slice(lessonsEnd);

// 2) import 줄 추가: 마지막 import 줄 바로 아래
const importLine = `import { ${spec.exportName} } from "./${spec.fileName.replace(/\.js$/, ".js")}";`;
const lines = updated.split("\n");
let lastImport = -1;
lines.forEach((l, i) => {
  if (l.startsWith("import ")) lastImport = i;
});
lines.splice(lastImport + 1, 0, importLine);
updated = lines.join("\n");

// 3) 데이터 파일 쓰기 → 등록 → 점검 (실패하면 되돌린다)
const dataFile =
  `/* ${spec.title} — 자동 생성 (tools/new-lesson.mjs) */\n\n` +
  `export const ${spec.exportName} = ${JSON.stringify(spec.questions, null, 2)};\n`;

writeFileSync(dataPath, dataFile, "utf8");
writeFileSync(subjectsPath, updated, "utf8");

try {
  const out = execFileSync(process.execPath, [resolve(root, "tools/check-questions.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  console.log(out.split("\n").slice(-3).join("\n"));
  console.log(`\n완료: src/data/${spec.fileName} 생성, subjects.js 에 "${spec.title}" 등록`);
} catch (err) {
  writeFileSync(subjectsPath, original, "utf8");
  unlinkSync(dataPath); // Windows 에서도 동작하도록 rm 명령 대신 사용
  console.error("점검에서 오류가 나서 원래 상태로 되돌렸어요.\n");
  console.error(err.stdout || err.message);
  process.exit(1);
}
