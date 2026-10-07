/**
 * Resume / autosave helpers for the WCPS assessment.
 *
 * Resume is SILENT: a returning participant never sees a "restoring your
 * answers" screen. The saved attempt is read synchronously from localStorage
 * during the first render, so the quiz opens directly on the first unanswered
 * question. A brand new participant likewise opens directly on Q1.
 *
 * Two layers of persistence are used:
 *
 *  1. Browser - localStorage keeps the current attempt (answers and the details
 *               typed into the final form). Read synchronously, so there is no
 *               visible loading step.
 *  2. Server  - the same attempt is mirrored to the Google Sheet through
 *               `/api/progress` under an anonymous `progressId` that also lives
 *               in the URL (`/quiz?p=<id>`), so the same link resumes on
 *               another device.
 *
 * Once the assessment is submitted the attempt is deleted from the browser and
 * a fresh id is issued, so the next visit starts again from Q1.
 */

import type { Answers } from "./scoring";

export const RESUME_PARAM = "p";
const STORAGE_KEY = "wcps:attempt:v2";
/** Autosave to the sheet at most once every 2.5 s while the user answers. */
export const SERVER_SYNC_DEBOUNCE_MS = 2500;

export type QuizStep = "quiz" | "form" | "done";

export type PersistedState = {
  progressId: string;
  answers: Answers;
  page: number;
  step: QuizStep;
  form: { name: string; email: string; country: string };
  savedAt: string;
};

/** Creates an id that is unique, URL-safe and long enough to be unguessable. */
export function createProgressId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function emptyState(progressId: string): PersistedState {
  return {
    progressId,
    answers: {},
    page: 1,
    step: "quiz",
    form: { name: "", email: "", country: "" },
    savedAt: new Date().toISOString(),
  };
}

/**
 * The attempt stored in this browser.
 *
 * When the URL carries an id, only a matching local attempt is reused —
 * otherwise the URL wins and the attempt is fetched from the server.
 */
export function readLocalState(progressId?: string): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== "object" || !parsed.answers) return null;
    if (progressId && parsed.progressId && parsed.progressId !== progressId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota - the browser layer is best-effort only */
  }
}

/** Removes the attempt from this browser; used once a submission succeeds. */
export function clearLocalState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Adds / updates the `p` parameter so the resume link can be shared. */
export function withResumeParam(href: string, progressId: string): string {
  const url = new URL(href, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  url.searchParams.set(RESUME_PARAM, progressId);
  return `${url.pathname}${url.search}`;
}

/** Removes the `p` parameter, so a finished attempt is not reopened. */
export function withoutResumeParam(href: string): string {
  const url = new URL(href, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  url.searchParams.delete(RESUME_PARAM);
  return `${url.pathname}${url.search}`;
}

/** The stored attempt as returned by `/api/progress` (answers already resolved). */
export type ServerProgress = {
  progressId: string;
  answers: Answers;
  page: number;
  step: QuizStep;
  form: { name: string; email: string; country: string };
  savedAt?: string;
  /** True when the attempt was already submitted; it is then never resumed. */
  completed?: boolean;
};

export function fetchServerState(progressId: string): Promise<ServerProgress | null> {
  return fetch(`/api/progress?p=${encodeURIComponent(progressId)}`, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { ok?: boolean; state?: ServerProgress | null } | null) => (data?.ok ? data.state ?? null : null))
    .catch(() => null);
}

export function pushServerState(state: PersistedState): Promise<boolean> {
  return fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
    keepalive: true,
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { ok?: boolean } | null) => Boolean(data?.ok))
    .catch(() => false);
}
