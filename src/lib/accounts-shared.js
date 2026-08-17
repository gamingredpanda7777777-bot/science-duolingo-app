/* ============================================================
   로컬 모드와 서버 모드가 함께 쓰는 규칙
   ============================================================ */

/* 알파벳 26자 + 숫자 10자 전부 사용 */
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const CODE_LENGTH = 10;

/* 보기 좋게 4-3-3 으로 끊어 표시 */
export function formatCode(code) {
  if (!code || code.length !== CODE_LENGTH) return code || "";
  return `${code.slice(0, 4)}-${code.slice(4, 7)}-${code.slice(7)}`;
}

export function normalizeCode(input) {
  return String(input || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/* 로컬 모드에서만 쓴다. 서버 모드에서는 서버가 코드를 만든다. */
export function generateCode(existing = {}) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    const buf = new Uint32Array(CODE_LENGTH);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    } else {
      for (let i = 0; i < CODE_LENGTH; i++)
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing[code]) return code;
  }
  return (Date.now().toString(36).toUpperCase() + "XXXXXXXXXX").slice(0, CODE_LENGTH);
}

/* store 를 주면 중복까지 검사한다(로컬 모드). 서버 모드에서는 서버가 중복을 본다. */
export function validateId(id, store = null, exceptCode = null) {
  const value = String(id || "").trim();
  if (value.length < 4 || value.length > 16) return "아이디는 4~16자로 정해 주세요.";
  if (!/^[A-Za-z0-9_]+$/.test(value)) return "아이디는 영문, 숫자, _ 만 쓸 수 있어요.";
  if (store) {
    const taken = Object.values(store).some(
      (a) => a.id.toLowerCase() === value.toLowerCase() && a.code !== exceptCode
    );
    if (taken) return "이미 쓰고 있는 아이디예요.";
  }
  return null;
}

export function validatePassword(pw) {
  const value = String(pw || "");
  if (value.length < 6) return "비밀번호는 6자 이상으로 정해 주세요.";
  if (value.length > 64) return "비밀번호가 너무 길어요.";
  return null;
}
