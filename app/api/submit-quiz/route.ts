/**
 * POST /api/submit-quiz
 *
 * Server-side pipeline for one completed assessment:
 *   1. Validate the payload (all 27 questions answered, plus name/email/country).
 *   2. Compute WCPS + Perseverance / Self-Mastery / Growth scores.
 *   3. Pick the matching report template (1 of 27) from `public/`.
 *   4. Fill [NAME] and "[XX]/100 - [WCPS LABEL]" in the Word report.
 *   5. Convert it to PDF (when LibreOffice is available) and name it after the user.
 *   6. Email the finished report to the participant via SMTP (Nodemailer).
 *   7. Log everything to Google Sheets through the Apps Script Web App:
 *      name, email, country, the ANSWER TEXT the participant chose for each of
 *      the 27 questions, the computed scores, the email delivery outcome, the
 *      archived report link, and the completed status of the attempt identified
 *      by `progressId` (so the in-progress row is updated, not duplicated).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { fillDocxTemplate, safeFileStem } from "@/lib/docx";
import { mailerConfigured, sendReportEmail } from "@/lib/mailer";
import { convertDocxToPdf } from "@/lib/pdf";
import { ALL_QUESTIONS, BEHAVIOUR_QUESTION_IDS, QUESTION_ORDER, TOTAL_PAGES, answerTexts } from "@/lib/quizData";
import { computeScore, wcpsDisplay, type Answers } from "@/lib/scoring";
import {
  sheetsConfigured,
  syncSubmission,
  toBase64Attachment,
  type EmailDeliveryStatus,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

const REQUIRED_IDS = [...BEHAVIOUR_QUESTION_IDS, "q21", "q22", "q23", "q24", "q25", "q26", "q27"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Payload = {
  progressId?: string;
  name?: string;
  email?: string;
  country?: string;
  answers?: Answers;
};

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function validate(body: Payload): string | null {
  if (!body.name || body.name.trim().length < 2) return "Please enter your full name.";
  if (!body.email || !EMAIL_RE.test(body.email.trim())) return "Please enter a valid email address.";
  if (!body.country || !body.country.trim()) return "Please select your country of residence.";

  const answers = body.answers ?? {};
  const missing = REQUIRED_IDS.filter((id) => {
    const question = ALL_QUESTIONS[id];
    if (!question) return true;
    const index = answers[id];
    return index === undefined || !question.options[index];
  });

  if (missing.length > 0) {
    return `Some questions are not answered yet (${missing.length}). Please complete all ${REQUIRED_IDS.length} questions.`;
  }
  return null;
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return badRequest("Invalid request body.");
  }

  const validationError = validate(body);
  if (validationError) return badRequest(validationError);

  const name = (body.name as string).trim();
  const email = (body.email as string).trim();
  const country = (body.country as string).trim();
  const answers = body.answers as Answers;
  const progressId = (body.progressId ?? "").trim();
  /** What the participant answered, as text — this is what the sheet logs. */
  const chosenAnswers = answerTexts(answers);

  // The COI comes from Q22 inside the answers; `country` (residence) is only
  // stored as contact detail and never influences the score.
  const result = computeScore(answers);
  const display = wcpsDisplay(result);
  const fileStem = `${safeFileStem(name)}_WCPS_Report`;
  const templateName = `Report_${String(result.reportNumber).padStart(2, "0")}.docx`;

  // 1. Load the matching report template.
  let template: Buffer;
  try {
    template = await readFile(path.join(process.cwd(), "public", templateName));
  } catch {
    return NextResponse.json(
      { ok: false, error: `Report template ${templateName} was not found in the public folder.` },
      { status: 500 },
    );
  }

  // 2. Personalise it.
  const filledDocx = await fillDocxTemplate(template, { name, wcpsDisplay: display });

  const summary = {
    wcps: result.wcps,
    label: result.label,
    interpretation: result.interpretation,
    behaviour: result.behaviour,
    coi: result.coi,
    innerProfile: result.innerProfile,
    report: templateName,
    dimensions: result.dimensions.map((d) => ({ label: d.label, score: d.score, level: d.level })),
  };

  const sheetRecord = {
    progressId,
    form: { name, email, country },
    answerTexts: chosenAnswers,
    answers,
    scores: {
      wcps: result.wcps,
      label: result.label,
      interpretation: result.interpretation,
      innerProfile: result.innerProfile,
      behaviour: result.behaviour,
      coi: result.coi,
      career: result.career,
      financial: result.financial,
      wealthRoute: result.wealthRoute,
      age: result.age,
      targetHorizon: result.targetHorizon,
      education: result.education,
      reportNumber: result.reportNumber,
      reportFile: templateName,
      dimensions: summary.dimensions,
    },
  };

  /**
   * Pushes the submission and its email outcome to the sheet. Returns whether
   * the row was actually written; a sheet outage is logged, never thrown.
   */
  const recordInSheet = async (
    status: EmailDeliveryStatus,
    file: { filename: string; mimeType: string; content: Buffer },
    extra: { deliveredAs?: "pdf" | "docx"; error?: string } = {},
  ): Promise<boolean> => {
    if (!sheetsConfigured()) {
      console.warn("[submit-quiz] APPS_SCRIPT_URL is not set; skipping the Google Sheets sync.");
      return false;
    }

    const sync = await syncSubmission({
      ...sheetRecord,
      email: { status, to: email, sentAt: new Date().toISOString(), attachmentName: file.filename, ...extra },
      attachment: toBase64Attachment(file.filename, file.mimeType, file.content),
    });

    if (!sync.ok) {
      console.error("[submit-quiz] Google Sheets sync failed:", sync.error);
      return false;
    }
    return sync.recorded;
  };

  const docxAttachment = { filename: `${fileStem}.docx`, mimeType: DOCX_MIME, content: filledDocx };

  // 3. Email the report. SMTP problems must be reported, not silently ignored.
  if (!mailerConfigured()) {
    console.error("[submit-quiz] SMTP credentials are not configured (SMTP_PASS missing?).");
    const sheetRecorded = await recordInSheet("not_configured", docxAttachment, {
      deliveredAs: "docx",
      error: "SMTP credentials are not configured.",
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Your responses were saved, but the email service is not configured yet. Please contact the administrator.",
        summary,
        sheetRecorded,
      },
      { status: 503 },
    );
  }

  const pdf = await convertDocxToPdf(filledDocx, fileStem);
  const attachment = pdf
    ? { filename: `${fileStem}.pdf`, content: pdf.pdf }
    : { filename: `${fileStem}.docx`, content: filledDocx };
  const deliveredAs = pdf ? ("pdf" as const) : ("docx" as const);

  try {
    await sendReportEmail({
      to: email,
      name,
      wcpsDisplay: display,
      label: result.label,
      interpretation: result.interpretation,
      innerProfile: result.innerProfile,
      dimensions: summary.dimensions,
      attachment,
      attachmentIsPdf: Boolean(pdf),
    });
  } catch (error) {
    console.error("[submit-quiz] Failed to send report email:", error);
    const sheetRecorded = await recordInSheet(
      "failed",
      { filename: attachment.filename, mimeType: pdf ? PDF_MIME : DOCX_MIME, content: attachment.content },
      {
        deliveredAs,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return NextResponse.json(
      {
        ok: false,
        error: "We could not send your report email right now. Please try again in a few minutes.",
        summary,
        sheetRecorded,
      },
      { status: 502 },
    );
  }

  const sheetRecorded = await recordInSheet(
    "sent",
    { filename: attachment.filename, mimeType: pdf ? PDF_MIME : DOCX_MIME, content: attachment.content },
    { deliveredAs },
  );

  return NextResponse.json({
    ok: true,
    sentTo: email,
    questions: QUESTION_ORDER.length,
    pages: TOTAL_PAGES,
    deliveredAs,
    summary,
    sheetRecorded,
  });
}
