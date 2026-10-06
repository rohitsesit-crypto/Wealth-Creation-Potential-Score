/**
 * POST /api/submit-quiz
 *
 * Server-side pipeline for one completed assessment:
 *   1. Validate the payload (all 27 questions answered).
 *   2. Compute WCPS + Perseverance / Self-Mastery / Growth scores.
 *   3. Pick the matching report template (1 of 27) from `public/`.
 *   4. Fill [NAME] and "[XX]/100 - [WCPS LABEL]" in the Word report.
 *   5. Convert it to PDF (when LibreOffice is available) and name it after the user.
 *   6. Email the finished report to the participant via SMTP (Nodemailer).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { fillDocxTemplate, safeFileStem } from "@/lib/docx";
import { sendReportEmail, mailerConfigured } from "@/lib/mailer";
import { convertDocxToPdf } from "@/lib/pdf";
import { ALL_QUESTIONS, BEHAVIOUR_QUESTION_IDS, TOTAL_PAGES } from "@/lib/quizData";
import { computeScore, wcpsDisplay, type Answers } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_IDS = [
  ...BEHAVIOUR_QUESTION_IDS,
  "q21",
  "q22",
  "q23",
  "q24",
  "q25",
  "q26",
  "q27",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Payload = {
  name?: string;
  email?: string;
  mobile?: string;
  dob?: string;
  gender?: string;
  country?: string;
  occupation?: string;
  answers?: Answers;
  volunteer?: string;
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

  const result = computeScore(answers, country);
  const display = wcpsDisplay(result);
  const fileStem = `${safeFileStem(name)}_WCPS_Report`;

  // 1. Load the matching report template.
  let template: Buffer;
  const templateName = `Report_${String(result.reportNumber).padStart(2, "0")}.docx`;
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

  // 3. Email the report. SMTP problems must be reported, not silently ignored.
  if (!mailerConfigured()) {
    console.error("[submit-quiz] SMTP credentials are not configured (SMTP_PASS missing?).");
    return NextResponse.json(
      {
        ok: false,
        error:
          "Your responses were saved, but the email service is not configured yet. Please contact the administrator.",
        summary,
      },
      { status: 503 },
    );
  }

  const pdf = await convertDocxToPdf(filledDocx, fileStem);
  const attachment = pdf
    ? { filename: `${fileStem}.pdf`, content: pdf.pdf }
    : { filename: `${fileStem}.docx`, content: filledDocx };

  try {
    await sendReportEmail({
      to: email,
      name,
      wcpsDisplay: display,
      label: result.label,
      interpretation: result.interpretation,
      innerProfile: result.innerProfile,
      dimensions: result.dimensions.map((d) => ({ label: d.label, score: d.score, level: d.level })),
      attachment,
      attachmentIsPdf: Boolean(pdf),
      volunteer: body.volunteer || undefined,
    });
  } catch (error) {
    console.error("[submit-quiz] Failed to send report email:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "We could not send your report email right now. Please try again in a few minutes.",
        summary,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    sentTo: email,
    pages: TOTAL_PAGES,
    deliveredAs: pdf ? "pdf" : "docx",
    summary,
  });
}
