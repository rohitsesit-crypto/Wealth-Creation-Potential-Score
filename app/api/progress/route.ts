/**
 * Progress bridge between the browser and the Google Sheet.
 *
 *   GET  /api/progress?p=<progressId>   -> the saved attempt for that id
 *   POST /api/progress                  -> upsert the current attempt (autosave)
 *
 * The browser speaks in option indexes; the spreadsheet stores the answer TEXT
 * the participant chose. This route is the only place that translates between
 * the two, so the option wording stays defined once, in lib/quizData.ts.
 *
 * The route depends on nothing but `APPS_SCRIPT_URL`, so an unfinished attempt
 * survives even when the participant never reaches the final form.
 */

import { NextResponse } from "next/server";

import { answersFromTexts, answerTexts } from "@/lib/quizData";
import { fetchProgress, saveProgress, sheetsConfigured } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProgressBody = {
  progressId?: string;
  answers?: Record<string, number>;
  page?: number;
  step?: string;
  form?: { name?: string; email?: string; country?: string };
};

const clean = (value: unknown, max = 200) => String(value ?? "").slice(0, max);

/** Keeps only the three details the assessment actually collects. */
const cleanForm = (form: ProgressBody["form"]) => ({
  name: clean(form?.name, 120),
  email: clean(form?.email, 160),
  country: clean(form?.country, 80),
});

function normalizeAnswers(source: Record<string, number> | undefined): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    const index = Number(value);
    if (Number.isInteger(index) && index >= 0) answers[key] = index;
  }
  return answers;
}

export async function GET(request: Request) {
  const progressId = new URL(request.url).searchParams.get("p") ?? "";
  if (!progressId) return NextResponse.json({ ok: false, error: "Missing progress id." }, { status: 400 });
  if (!sheetsConfigured()) return NextResponse.json({ ok: true, state: null, persisted: false });

  const stored = await fetchProgress(progressId);
  if (!stored) return NextResponse.json({ ok: true, state: null, persisted: false });

  const answers = answersFromTexts(stored.answerTexts ?? {});
  return NextResponse.json({
    ok: true,
    persisted: true,
    state: {
      progressId: stored.progressId,
      answers,
      // The first page still missing an answer is where the participant resumes.
      page: 1,
      step: "quiz",
      form: cleanForm(stored.form),
      savedAt: stored.savedAt ?? "",
      completed: Boolean(stored.completed),
    },
  });
}

export async function POST(request: Request) {
  let raw: ProgressBody;
  try {
    raw = (await request.json()) as ProgressBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const progressId = clean(raw.progressId, 64);
  if (!progressId) return NextResponse.json({ ok: false, error: "Missing progress id." }, { status: 400 });

  const answers = normalizeAnswers(raw.answers);
  if (!sheetsConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const result = await saveProgress({
    progressId,
    // Stored as text: the sheet keeps what the participant answered.
    answerTexts: answerTexts(answers),
    page: Math.max(1, Math.min(50, Number(raw.page) || 1)),
    step: ["quiz", "form", "done"].includes(String(raw.step)) ? String(raw.step) : "quiz",
    form: cleanForm(raw.form),
    savedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: result.ok, persisted: result.ok, error: result.error });
}
