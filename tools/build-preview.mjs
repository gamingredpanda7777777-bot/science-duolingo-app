/* ============================================================
   미리보기용 단일 파일 만들기

   실행:  npm run build:preview

   src/ 의 여러 파일을 하나로 합쳐 preview/science_duolingo_app.jsx 를 만든다.
   파일 하나만 실행할 수 있는 미리보기 환경에서 쓰려고 만드는 것이고,
   실제 배포에는 쓰지 않는다. 원본은 언제나 src/ 폴더다.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

/* 로컬 파일 import 줄만 제거한다 (react, lucide-react 는 남긴다) */
const stripLocalImports = (t) =>
  t.replace(/^import\s+\{[^}]*\}\s+from\s+"\.[^"]*";\s*\n/gm, "");

/* export 키워드 제거 — 한 파일 안에서는 필요 없다 */
const unexport = (t) =>
  t
    .replace(/^export const /gm, "const ")
    .replace(/^export function /gm, "function ")
    .replace(/^export async function /gm, "async function ")
    .replace(/^export \{[^}]*\};\s*$/gm, ""); // 재수출 줄 제거

/* 미리보기는 npm 패키지를 불러올 수 없으므로 로컬 모드만 담는다.
   (supabase.js / accounts-remote.js / accounts.js 는 제외) */
const DATA_FILES = [
  "src/lib/accounts-shared.js",
  "src/lib/accounts-local.js",
  "src/lib/progress.js",
  "src/data/physics.js",
  "src/data/unit4-sense.js",
  "src/data/unit4-nerve.js",
  "src/data/unit4-homeostasis.js",
  "src/data/unit4-advanced.js",
  "src/data/unit5-cell.js",
  "src/data/unit5-chromosome.js",
  "src/data/unit5-meiosis.js",
  "src/data/unit5-development.js",
  "src/data/heredity-mendel.js",
  "src/data/heredity-independent.js",
  "src/data/heredity-human.js",
  "src/data/subjects.js",
];

const parts = DATA_FILES.map((f) => unexport(stripLocalImports(read(f))).trim());

/* 미리보기는 언제나 로컬 모드 */
parts.push("/* 미리보기 빌드: 서버 모드 없음 */\nconst serverMode = false;");

const app = read("src/App.jsx");
const headMatch = app.match(/^[\s\S]*?from "lucide-react";\n/);
if (!headMatch) {
  throw new Error("App.jsx 에서 lucide-react import 블록을 찾지 못했습니다.");
}
const head = headMatch[0];
const body = stripLocalImports(app.slice(head.length)).trimStart();

const out = `${head}\n${parts.join("\n\n")}\n\n${body}`;

/* 합친 결과 자체 점검 */
const leftover = out.match(/^import.*"\.\/.*$/gm);
if (leftover) throw new Error("로컬 import 가 남아 있습니다: " + leftover.join(", "));

const names = [...out.matchAll(/^(?:const|function) (\w+)/gm)].map((m) => m[1]);
const dup = names.filter((n, i) => names.indexOf(n) !== i);
if (dup.length) throw new Error("이름이 중복됐습니다: " + [...new Set(dup)].join(", "));

let brace = 0;
for (const c of out) {
  if (c === "{") brace++;
  else if (c === "}") brace--;
}
if (brace !== 0) throw new Error("중괄호 짝이 맞지 않습니다: " + brace);

mkdirSync(resolve(root, "preview"), { recursive: true });
writeFileSync(resolve(root, "preview/science_duolingo_app.jsx"), out);

console.log(`preview/science_duolingo_app.jsx 생성 완료 (${out.length.toLocaleString()}자)`);
console.log(`최상위 선언 ${names.length}개 · 중복 없음 · 괄호 정상`);
