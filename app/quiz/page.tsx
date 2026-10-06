"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import CountrySelect from "@/components/CountrySelect";
import { getCountries, type Country } from "@/lib/countries";
import {
  ALL_QUESTIONS,
  COI_COUNTRY_OPTIONS,
  COI_QUESTION,
  QUIZ_PAGES,
  TOTAL_PAGES,
} from "@/lib/quizData";
import type { Answers } from "@/lib/scoring";

import styles from "./quiz.module.css";

type Summary = {
  wcps: number;
  label: string;
  interpretation: string;
  innerProfile: string;
  dimensions: { label: string; score: number; level: string }[];
};

type Step = "quiz" | "form" | "done";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Simple label + native select, used for the Age and career-path dropdowns. */
function Dropdown({
  questionId,
  label,
  options,
  value,
  onChange,
}: {
  questionId: string;
  label: string;
  options: { text: string }[];
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.dropdownField}>
      <div className={styles.selectWrap}>
        <select
          id={questionId}
          className={styles.select}
          aria-label={label}
          value={value === undefined ? "" : String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="" disabled>
            {label}
          </option>
          {options.map((option, index) => (
            <option key={option.text} value={index}>
              {option.text}
            </option>
          ))}
        </select>
        <svg className={styles.selectCaret} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function QuizFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const volunteerRef = searchParams.get("ref") ?? "";

  const [step, setStep] = useState<Step>("quiz");
  const [page, setPage] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [toast, setToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Full country list for the residence dropdown. `getCountries()` is a cached,
  // deterministic helper, so it is safe to resolve during render.
  const countries = useMemo<Country[]>(() => getCountries(), []);

  const [form, setForm] = useState({ name: "", email: "", country: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sentTo, setSentTo] = useState("");

  const pageIds = useMemo(() => QUIZ_PAGES[page - 1]?.ids ?? [], [page]);
  const currentQuestions = useMemo(
    () => pageIds.map((id) => ALL_QUESTIONS[id]).filter(Boolean),
    [pageIds],
  );

  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalQuestions = pageIds.length;
  const answeredOnPage = pageIds.filter((id) => answers[id] !== undefined).length;
  const answeredTotal = Object.keys(answers).length;
  const progress = ((page - 1) / TOTAL_PAGES) * 100 + (answeredOnPage / totalQuestions) * (100 / TOTAL_PAGES);

  const handleAnswer = (id: string, index: number) => {
    setAnswers((prev) => ({ ...prev, [id]: index }));
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToast(true);
    window.setTimeout(() => setToast(false), 2600);
  };

  const handleNext = () => {
    const missing = pageIds.filter((id) => answers[id] === undefined);
    if (missing.length > 0) {
      showToast(
        missing.length === 1
          ? "Please answer the question on this page before continuing"
          : `Please answer all ${missing.length} questions on this page before continuing`,
      );
      return;
    }
    if (page < TOTAL_PAGES) {
      setPage((prev) => prev + 1);
      scrollTop();
    } else {
      setStep("form");
      scrollTop();
    }
  };

  const handleBack = () => {
    if (step === "form") {
      setStep("quiz");
      scrollTop();
      return;
    }
    if (page === 1) {
      router.push("/");
      return;
    }
    setPage((prev) => prev - 1);
    scrollTop();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!form.country.trim()) {
      setFormError("Please select your country of residence.");
      return;
    }
    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          country: form.country.trim(),
          answers,
          volunteer: volunteerRef,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; summary?: Summary };

      if (!response.ok || !data.ok || !data.summary) {
        setFormError(data.error || "Something went wrong while submitting. Please try again.");
        setSubmitting(false);
        return;
      }

      setSummary(data.summary);
      setSentTo(form.email.trim());
      setStep("done");
      setSubmitting(false);
      scrollTop();
    } catch {
      setFormError("We could not reach the server. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  /* ----------------------------- Done screen ----------------------------- */
  if (step === "done" && summary) {
    return (
      <div className={`app-canvas ${styles.page}`}>
        <div className={styles.doneWrap}>
          <div className={`card ${styles.doneCard} rise`}>
            <div className={styles.doneBadge}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className={styles.doneTitle}>All done, {form.name.split(" ")[0]}!</h1>
            <p className={styles.doneText}>
              Your report has been prepared and sent to <strong>{sentTo}</strong>. It usually arrives within a minute — please
              check your spam folder if you do not see it.
            </p>

            <div className={styles.scorePanel}>
              <p className={styles.scoreCaption}>YOUR WEALTH CREATION POTENTIAL SCORE</p>
              <p className={styles.scoreValue}>
                {Math.round(summary.wcps)}<span>/100</span>
              </p>
              <p className={styles.scoreLabel}>{summary.label}</p>
              <p className={styles.scoreInterpretation}>{summary.interpretation}</p>
            </div>

            <div className={styles.chipRow}>
              {summary.dimensions.map((dimension) => (
                <div key={dimension.label} className={styles.chip}>
                  <span className={styles.chipLabel}>{dimension.label}</span>
                  <span className={styles.chipValue}>{dimension.score}</span>
                  <span className={styles.chipLevel}>{dimension.level}</span>
                </div>
              ))}
            </div>

            <button type="button" className={styles.btnPrimary} onClick={() => router.push("/")}>
              Back to start
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- Form screen ----------------------------- */
  if (step === "form") {
    return (
      <div className={`app-canvas ${styles.page}`}>
        <div className={styles.formWrap}>
          <div className={`card ${styles.formCard} rise`}>
            <h1 className={styles.formTitle}>Wealth Creation Potential Score</h1>
            <p className={styles.formSubtitle}>
              Three quick details and we will email your personalised Wealth Creation Potential report.
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="name">
                  Full name <span className={styles.req}>*</span>
                </label>
                
                <input
                  id="name"
                  className={styles.input}
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email address <span className={styles.req}>*</span>
                </label>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="residence">
                  Country of residence <span className={styles.req}>*</span>
                </label>
                <CountrySelect
                  inputId="residence"
                  value={form.country}
                  onChange={(value) => setForm({ ...form, country: value })}
                  countries={countries}
                  placeholder="Select your country of residence"
                />
              </div>

              {formError && <p className={styles.formError}>{formError}</p>}

              <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                {submitting ? "Preparing your report…" : "Submit"}
              </button>

              <button type="button" className={styles.linkBtn} onClick={handleBack}>
                ← Back to questions
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- Quiz screen ----------------------------- */
  return (
    <div className={`app-canvas ${styles.page}`}>
      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`} role="status" aria-live="polite">
        {toastMessage}
      </div>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.brandTitle}>WEALTH CREATION POTENTIAL SCORE</h1>
            <p className={styles.brandSub}>
              Question {page} of {TOTAL_PAGES}
            </p>
          </div>
          <span className={styles.counter}>
            {answeredTotal}/27 answered
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.max(progress, 3)}%` }} />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.grid}>
          {pageIds[0] === "q22" ? (
            <section className={`card ${styles.qCard} rise`}>
              <p className={styles.qLabel}>{COI_QUESTION.label}</p>
              <h2 className={styles.qTitle}>{COI_QUESTION.text}</h2>
              <p className={styles.qHint}>{COI_QUESTION.hint}</p>
              <CountrySelect
                inputId="q22-country"
                value={answers.q22 === undefined ? "" : COI_COUNTRY_OPTIONS[answers.q22]?.name ?? ""}
                onChange={(value) => {
                  const index = COI_COUNTRY_OPTIONS.findIndex((country) => country.name === value);
                  if (index >= 0) handleAnswer("q22", index);
                }}
                countries={COI_COUNTRY_OPTIONS}
                placeholder="Select the country"
              />
            </section>
          ) : (
            currentQuestions.map((question) => {
              const dropdown = question.id === "q21" || question.id === "q23";
              return (
                <section key={question.id} className={`card ${styles.qCard} rise`}>
                  <p className={styles.qLabel}>{question.label}</p>
                  {question.title && <h3 className={styles.qScenario}>{question.title}</h3>}
                  {dropdown ? (
                    <>
                      <h2 className={styles.qTitle}>{question.text}</h2>
                      <Dropdown
                        questionId={`${question.id}-select`}
                        label="Select an option"
                        options={question.options}
                        value={answers[question.id]}
                        onChange={(value) => handleAnswer(question.id, value)}
                      />
                    </>
                  ) : (
                    <>
                      <h2 className={styles.qTitle}>{question.text}</h2>
                      <div className={styles.options}>
                        {question.options.map((option, index) => {
                          const selected = answers[question.id] === index;
                          return (
                            <button
                              key={option.text}
                              type="button"
                              aria-pressed={selected}
                              className={`option ${selected ? "option-selected" : ""}`}
                              onClick={() => handleAnswer(question.id, index)}
                            >
                              <span className={styles.optionText}>{option.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              );
            })
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <button type="button" className={styles.btnGhost} onClick={handleBack}>
            Back
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleNext}>
            {page === TOTAL_PAGES ? "Continue" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className={`app-canvas ${styles.page}`}>
          <div className={styles.formWrap}>
            <div className={styles.loading}>Loading your assessment…</div>
          </div>
        </div>
      }
    >
      <QuizFlow />
    </Suspense>
  );
}
