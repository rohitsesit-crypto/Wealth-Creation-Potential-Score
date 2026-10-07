/**
 * Bridge between the Next.js app and the Google Apps Script Web App.
 *
 * The script owns the spreadsheet; the Next app owns the email. Three calls
 * are used:
 *
 *   saveProgress   - autosave an unfinished attempt (resume support)
 *   fetchProgress  - restore an unfinished attempt
 *   syncSubmission - write the completed assessment + the email outcome
 *
 * What is stored per question is the ANSWER THE PARTICIPANT CHOSE (its text),
 * not the marks it scored. Marks are only used to compute the WCPS and to pick
 * the report template, which live in their own columns.
 *
 * Server-side configuration (never exposed to the browser):
 *   APPS_SCRIPT_URL  the /exec URL of the deployed Apps Script Web App
 *   SHEET_TOKEN      optional shared secret, verified by the script when set
 */

import type { Answers } from "./scoring";

const REQUEST_TIMEOUT_MS = 20_000;
/** Reports bigger than this are still logged, but the file is not archived. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const env = (key: string): string => (process.env[key] ?? "").trim();

export function sheetsConfigured(): boolean {
  return Boolean(env("APPS_SCRIPT_URL"));
}

export type EmailDeliveryStatus = "sent" | "failed" | "not_configured";

export type ProgressForm = { name: string; email: string; country: string };

/* ----------------------------- Resume / progress ---------------------------- */

/** The autosaved attempt, with the answers already stored as text. */
export type ProgressState = {
  progressId: string;
  /** Chosen answer text, keyed "Q1" … "Q27". */
  answerTexts: Record<string, string>;
  page: number;
  step: string;
  form: ProgressForm;
  savedAt?: string;
};

/** What `getProgress` returns: the stored text answers plus the form details. */
export type StoredProgress = {
  progressId: string;
  answerTexts: Record<string, string>;
  form: ProgressForm;
  /** True once the attempt was submitted; such an attempt is never resumed. */
  completed: boolean;
  savedAt?: string;
};

export type ProgressResult = { ok: boolean; recorded?: boolean; error?: string };

/** GET <APPS_SCRIPT_URL>?action=getProgress&... — never throws. */
export async function fetchProgress(progressId: string): Promise<StoredProgress | null> {
  const url = env("APPS_SCRIPT_URL");
  if (!url || !progressId) return null;

  const endpoint = `${url}${url.includes("?") ? "&" : "?"}action=getProgress&token=${encodeURIComponent(
    env("SHEET_TOKEN"),
  )}&progressId=${encodeURIComponent(progressId)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const data = JSON.parse(await response.text()) as { ok?: boolean; state?: StoredProgress | null };
    return data.ok && data.state && data.state.progressId ? data.state : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** POST action=saveProgress — upserts one row in the progress sheet. */
export async function saveProgress(state: ProgressState): Promise<ProgressResult> {
  const url = env("APPS_SCRIPT_URL");
  if (!url) return { ok: false, error: "APPS_SCRIPT_URL is not configured." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveProgress", token: env("SHEET_TOKEN"), state }),
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, error: `Apps Script responded with HTTP ${response.status}.` };
    const data = JSON.parse(await response.text()) as ProgressResult & { error?: string };
    return { ok: Boolean(data.ok), recorded: Boolean(data.recorded), error: data.error };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------- Final submission --------------------------- */

export type SheetSubmission = {
  /** Anonymous attempt id, so the completed row updates the in-progress row. */
  progressId: string;
  /** Only these three details are collected from the participant. */
  form: { name: string; email: string; country: string };
  /** The answers the participant chose, as text, keyed "Q1" … "Q27". */
  answerTexts: Record<string, string>;
  answers: Answers;
  scores: {
    wcps: number;
    label: string;
    interpretation: string;
    innerProfile: string;
    behaviour: number;
    coi: number;
    career: number;
    financial: number;
    wealthRoute: number;
    age: number;
    targetHorizon: number;
    education: number;
    reportNumber: number;
    reportFile: string;
    dimensions: { label: string; score: number; level: string }[];
  };
  email: {
    status: EmailDeliveryStatus;
    to: string;
    sentAt: string;
    deliveredAs?: "pdf" | "docx";
    attachmentName?: string;
    error?: string;
  };
  attachment?: { filename: string; mimeType: string; contentBase64: string };
};

export type SheetSyncResult = {
  ok: boolean;
  recorded: boolean;
  attachmentSaved: boolean;
  error?: string;
};

export function toBase64Attachment(
  filename: string,
  mimeType: string,
  content: Buffer,
): { filename: string; mimeType: string; contentBase64: string } {
  return { filename, mimeType, contentBase64: content.toString("base64") };
}

/**
 * POSTs one submission to the Apps Script Web App.
 *
 * Never throws: a spreadsheet problem must not break the participant's email,
 * so failures are surfaced through the returned result and the server log.
 */
export async function syncSubmission(submission: SheetSubmission): Promise<SheetSyncResult> {
  const url = env("APPS_SCRIPT_URL");
  if (!url) {
    return { ok: false, recorded: false, attachmentSaved: false, error: "APPS_SCRIPT_URL is not configured." };
  }

  const payload: Record<string, unknown> = {
    action: "recordSubmission",
    token: env("SHEET_TOKEN"),
    progressId: submission.progressId,
    form: submission.form,
    answerTexts: submission.answerTexts,
    answers: submission.answers,
    scores: submission.scores,
    email: submission.email,
  };

  const attachment = submission.attachment;
  if (attachment && Buffer.byteLength(attachment.contentBase64, "base64") <= MAX_ATTACHMENT_BYTES) {
    payload.attachment = attachment;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Apps Script answers with a 302 to script.googleusercontent.com, so the
    // request must follow redirects.
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        recorded: false,
        attachmentSaved: false,
        error: `Apps Script responded with HTTP ${response.status}.`,
      };
    }

    const data = JSON.parse(await response.text()) as {
      ok?: boolean;
      recorded?: boolean;
      attachmentSaved?: boolean;
      error?: string;
    };

    if (!data.ok) {
      return {
        ok: false,
        recorded: false,
        attachmentSaved: false,
        error: data.error || "Apps Script rejected the submission.",
      };
    }

    return {
      ok: true,
      recorded: Boolean(data.recorded),
      attachmentSaved: Boolean(data.attachmentSaved),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, recorded: false, attachmentSaved: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
