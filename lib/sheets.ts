/**
 * Google Sheets audit trail for the WCPS assessment.
 *
 * The Next.js API stays the sender of the participant email (SMTP +
 * Nodemailer) and additionally forwards every completed submission to a Google
 * Apps Script Web App, which appends the participant row to the "WCPS
 * Responses" tab and mirrors the report-email delivery outcome into a dedicated
 * "Email Status" tab.
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

/** The exact JSON contract expected by `recordSubmission` in the Apps Script. */
export type SheetSubmission = {
  form: {
    name: string;
    email: string;
    mobile: string;
    dob: string;
    gender: string;
    country: string;
    occupation: string;
    volunteer: string;
  };
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
    form: submission.form,
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
