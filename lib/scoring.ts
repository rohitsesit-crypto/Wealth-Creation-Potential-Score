/**
 * WCPS scoring engine.
 *
 * Implements the client-specified formulas exactly:
 *   B = ((Raw Q1–20 Score) − 21) / 59 × 100
 *   Direct questions (Q21, Q23, Q24, Q25, Q26, Q27) = (score − 1) / 3 × 100
 *   (weights follow the question: Q23 career path 10%, Q24 financial base 15%)
 *   Q22 = COI used directly (already 0–100)
 *
 *   WCPS = 0.40B + 0.20C + 0.15F + 0.10R + 0.05W + 0.025A + 0.025T + 0.05E
 *
 *   P = (Raw P − 8) / 24 × 100   (Q1,Q2,Q3,Q6,Q7,Q11,Q18,Q19)
 *   S = (Raw S − 5) / 11 × 100   (Q10,Q12,Q13,Q15)
 *   G = (Raw G − 8) / 24 × 100   (Q4,Q5,Q8,Q9,Q14,Q16,Q17,Q20)
 *
 * All results are clamped to 0–100 so an unusual answer set can never push a
 * score outside the documented range.
 */

import {
  ALL_QUESTIONS,
  BEHAVIOUR_QUESTION_IDS,
  COI_COUNTRIES,
  GROWTH_IDS,
  PERSEVERANCE_IDS,
  SELF_MASTERY_IDS,
} from "./quizData";

/** question id -> selected option index */
export type Answers = Record<string, number>;

export type DimensionKey = "p" | "s" | "g";
export type DimensionLevel = "Needs Attention" | "Developing" | "Strong";

export type DimensionResult = {
  key: DimensionKey;
  label: string;
  score: number;
  level: DimensionLevel;
};

export type ScoreResult = {
  behaviour: number;
  coi: number;
  financial: number;
  career: number;
  wealthRoute: number;
  age: number;
  targetHorizon: number;
  education: number;
  wcps: number;
  label: string;
  interpretation: string;
  dimensions: DimensionResult[];
  innerProfile: string;
  reportNumber: number;
  coiMatched: boolean;
};

/** Neutral fallback used when a participant's country has no published COI value. */
export const DEFAULT_COI = 50;

export const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
export const round1 = (value: number) => Math.round(value * 10) / 10;

export function getCoi(rawCountry: string): { score: number; matched: boolean } {
  if (!rawCountry) return { score: DEFAULT_COI, matched: false };
  const needle = rawCountry.trim().toLowerCase();
  const hit = COI_COUNTRIES.find((c) => c.name.toLowerCase() === needle);
  if (hit) return { score: hit.score, matched: true };
  // Common aliases so the COI still resolves for typical residence answers.
  const aliases: Record<string, string> = {
    usa: "United States",
    "united states of america": "United States",
    uk: "United Kingdom",
    "great britain": "United Kingdom",
    england: "United Kingdom",
    uae: "United Arab Emirates",
    "south korea": "South Korea",
    korea: "South Korea",
    "republic of korea": "South Korea",
  };
  const alias = aliases[needle];
  if (alias) {
    const aliasHit = COI_COUNTRIES.find((c) => c.name.toLowerCase() === alias.toLowerCase());
    if (aliasHit) return { score: aliasHit.score, matched: true };
  }
  return { score: DEFAULT_COI, matched: false };
}

function rawSum(ids: string[], answers: Answers): number {
  return ids.reduce((total, id) => {
    const question = ALL_QUESTIONS[id];
    const index = answers[id];
    if (!question || index === undefined) return total;
    const option = question.options[index];
    return total + (option ? option.points : 0);
  }, 0);
}

function directNormalized(id: string, answers: Answers): number {
  const question = ALL_QUESTIONS[id];
  const index = answers[id];
  if (!question || index === undefined) return 0;
  const option = question.options[index];
  if (!option) return 0;
  return clampPercent(((option.points - 1) / 3) * 100);
}

export function classify(score: number): DimensionLevel {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs Attention";
}

const LEVEL_MULTIPLIER: Record<DimensionLevel, number> = {
  "Needs Attention": 0,
  Developing: 1,
  Strong: 2,
};

/**
 * The 27 reports are indexed by the Perseverance / Self-Mastery / Growth mix:
 *   report = (P level × 9) + (S level × 3) + (G level × 1) + 1
 * which reproduces the supplied mapping table exactly.
 */
export function reportIndexFor(p: DimensionLevel, s: DimensionLevel, g: DimensionLevel): number {
  return LEVEL_MULTIPLIER[p] * 9 + LEVEL_MULTIPLIER[s] * 3 + LEVEL_MULTIPLIER[g] + 1;
}

export const WCPS_BANDS: { min: number; max: number; label: string; interpretation: string }[] = [
  {
    min: 80,
    max: 100,
    label: "Strongly Positioned",
    interpretation: "Several personal and contextual factors are currently aligned in your favour.",
  },
  {
    min: 65,
    max: 79,
    label: "Well Positioned",
    interpretation: "You have a useful foundation, with identifiable areas that can still be strengthened.",
  },
  {
    min: 50,
    max: 64,
    label: "Developing Potential",
    interpretation:
      "Your profile shows meaningful strengths as well as areas where deliberate development may improve readiness.",
  },
  {
    min: 35,
    max: 49,
    label: "Potential Needs Activation",
    interpretation:
      "Your current profile suggests that focused behavioural development could materially strengthen your position.",
  },
  {
    min: 0,
    max: 34,
    label: "Foundation Building Stage",
    interpretation:
      "Your best next step is to strengthen core habits, self-mastery and a constructive growth mindset.",
  },
];

export function wcpsBand(score: number) {
  const rounded = Math.round(clampPercent(score));
  return WCPS_BANDS.find((band) => rounded >= band.min && rounded <= band.max) ?? WCPS_BANDS[WCPS_BANDS.length - 1];
}

export function computeScore(answers: Answers, country: string): ScoreResult {
  const rawBehaviour = rawSum(BEHAVIOUR_QUESTION_IDS, answers);
  const behaviour = clampPercent(((rawBehaviour - 21) / 59) * 100);

  const { score: coi, matched } = getCoi(country);

  const pScore = clampPercent(((rawSum(PERSEVERANCE_IDS, answers) - 8) / 24) * 100);
  const sScore = clampPercent(((rawSum(SELF_MASTERY_IDS, answers) - 5) / 11) * 100);
  const gScore = clampPercent(((rawSum(GROWTH_IDS, answers) - 8) / 24) * 100);

  // Q23 is the career path and Q24 the starting financial base (as reordered by
  // the client), so the 15% / 10% weights follow the question, not the position.
  const career = directNormalized("q23", answers);
  const financial = directNormalized("q24", answers);
  const wealthRoute = directNormalized("q25", answers);
  const age = directNormalized("q21", answers);
  const targetHorizon = directNormalized("q26", answers);
  const education = directNormalized("q27", answers);

  const wcps = clampPercent(
    0.4 * behaviour +
      0.2 * coi +
      0.15 * financial +
      0.1 * career +
      0.05 * wealthRoute +
      0.025 * age +
      0.025 * targetHorizon +
      0.05 * education,
  );

  const band = wcpsBand(wcps);

  const dimensions: DimensionResult[] = [
    { key: "p", label: "Perseverance & Action", score: round1(pScore), level: classify(pScore) },
    { key: "s", label: "Self-Mastery & Discipline", score: round1(sScore), level: classify(sScore) },
    { key: "g", label: "Growth & Inner Mindset", score: round1(gScore), level: classify(gScore) },
  ];

  const [p, s, g] = dimensions;

  return {
    behaviour: round1(behaviour),
    coi,
    financial: round1(financial),
    career: round1(career),
    wealthRoute: round1(wealthRoute),
    age: round1(age),
    targetHorizon: round1(targetHorizon),
    education: round1(education),
    wcps: round1(wcps),
    label: band.label,
    interpretation: band.interpretation,
    dimensions,
    innerProfile: `P: ${p.level} | S: ${s.level} | G: ${g.level}`,
    reportNumber: reportIndexFor(p.level, s.level, g.level),
    coiMatched: matched,
  };
}

/** The exact string the client asked to appear inside the report: "[XX]/100 - [WCPS LABEL]". */
export function wcpsDisplay(result: ScoreResult): string {
  return `${Math.round(result.wcps)}/100 - ${result.label}`;
}
