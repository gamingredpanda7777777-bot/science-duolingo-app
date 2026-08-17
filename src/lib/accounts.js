/* ============================================================
   계정 모듈 — 서버 모드와 로컬 모드를 자동으로 골라 쓴다.

   .env 에 Supabase 키가 있으면  → 서버 모드 (기기 간 로그인 가능)
   키가 없으면                    → 로컬 모드 (이 기기에만 저장)

   화면 쪽 코드는 어느 쪽인지 신경 쓸 필요가 없다. 함수 이름과
   반환 형태가 같기 때문이다. 모든 함수는 async 이다.
   ============================================================ */

import { isServerMode } from "./supabase.js";
import * as local from "./accounts-local.js";
import * as remote from "./accounts-remote.js";

const backend = isServerMode ? remote : local;

export const serverMode = isServerMode;

export const formatCode = backend.formatCode;
export const normalizeCode = backend.normalizeCode;

export const getCurrentAccount = backend.getCurrentAccount;
export const createAccount = backend.createAccount;
export const login = backend.login;
export const logout = backend.logout;
export const changeId = backend.changeId;
export const changePassword = backend.changePassword;
export const deleteAccount = backend.deleteAccount;

/* 학습 기록 동기화 (로컬 모드에서는 아무것도 하지 않는다) */
export const fetchProgress = backend.fetchProgress;
export const pushProgress = backend.pushProgress;
