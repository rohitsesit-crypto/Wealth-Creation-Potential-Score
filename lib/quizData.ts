/**
 * All 27 questions of the Wealth Creation Potential Score (WCPS) assessment.
 *
 *  - Q1–Q20  Behaviour questions (4 options each).
 *  - Q21     Age (dropdown).
 *  - Q22     Country where you expect to build your career / business (dropdown, COI).
 *  - Q23     Which career path are you most likely to pursue? (dropdown)
 *  - Q24     Current starting financial base (dropdown).
 *  - Q25     Expected wealth-building route (dropdown).
 *  - Q26     Target horizon for US$1 million (dropdown).
 *  - Q27     Current education / career stage (dropdown).
 *
 * MARKING (corrected)
 * The per-option marks below are the authoritative table supplied by the
 * client. Every option is worth at least 1 mark, so the behaviour block spans
 * 20–80 raw marks instead of the earlier 0-based table:
 *
 *   q1  [2,4,1,3]   q2  [3,2,1,4]   q3  [1,4,2,3]   q4  [1,4,2,3]
 *   q5  [4,1,2,3]   q6  [3,1,2,4]   q7  [4,2,3,1]   q8  [1,4,2,3]
 *   q9  [4,1,3,2]   q10 [2,4,3,4]   q11 [2,4,3,1]   q12 [1,3,4,2]
 *   q13 [1,2,4,3]   q14 [1,2,3,4]   q15 [2,1,4,3]   q16 [1,2,3,4]
 *   q17 [2,1,4,3]   q18 [1,3,4,2]   q19 [1,2,4,3]   q20 [4,2,3,1]
 *
 *   q21 [4,4,3,3,2,2,1]            q23 [4,3,3,4,4,3,3,2,2,2]
 *   q24 [1,2,3,4,4]                q25 [2,3,4,3,4,1]
 *   q26 [4,4,3,2,1]                q27 [3,4,4,4,3,4,2]
 *
 * (In that table the client's two comments are swapped: the 5-value row is the
 * starting financial base — Q24 here — and the 10-value row is the career path,
 * Q23. The values line up with the option order rendered on screen.)
 *
 * Q22 carries no marks of its own: selecting a country returns that country's
 * Country Opportunity Index (COI, already a 0–100 score).
 *
 * The scoring rules themselves live in lib/scoring.ts.
 */

export type QuizOption = {
  text: string;
  /** Marks awarded for this option. */
  points: number;
};

export type ChoiceQuestion = {
  id: string;
  label: string;
  /** Optional scenario heading (used by the scenario questions Q11–Q20). */
  title?: string;
  text: string;
  options: QuizOption[];
};

type OptionTuple = [text: string, points: number];

const build = (tuples: OptionTuple[]): QuizOption[] =>
  tuples.map(([text, points]) => ({ text, points }));

/**
 * Q1–Q20 — behaviour questions, rendered in the order supplied by the client
 * (option A → D). Marks follow the corrected marking table above.
 */
export const BEHAVIOUR_QUESTIONS: ChoiceQuestion[] = [
  {
    id: "q1",
    label: "Q1/20",
    text: "You have two tasks: one simple and one complex. Which do you finish first?",
    options: build([
      ["The simple one, to warm up", 2],
      ["The complex one, while energy is high", 4],
      ["Switch between both", 1],
      ["Whichever feels interesting at that moment", 3],
    ]),
  },
  {
    id: "q2",
    label: "Q2/20",
    text: "Your study schedule was ruined for a week. How do you restart?",
    options: build([
      ["Continue exactly where I stopped", 3],
      ["Restart lightly but consistently", 2],
      ["Restart fully, even if overwhelming", 1],
      ["Understand the cause before restarting", 4],
    ]),
  },
  {
    id: "q3",
    label: "Q3/20",
    text: "You're close to finishing something and a new idea comes. What do you do?",
    options: build([
      ["Explore the new idea", 1],
      ["Finish first", 4],
      ["Ask someone for advice", 2],
      ["Work briefly on both", 3],
    ]),
  },
  {
    id: "q4",
    label: "Q4/20",
    text: "Someone gives you neutral feedback when you expected praise. What do you think?",
    options: build([
      ["\u201cMaybe I misunderstood the expectation.\u201d", 1],
      ["\u201cLet me try a different approach next time.\u201d", 4],
      ["\u201cThey didn't notice my effort.\u201d", 2],
      ["\u201cThis is normal; learning continues.\u201d", 3],
    ]),
  },
  {
    id: "q5",
    label: "Q5/20",
    text: "Someone asks you to teach something you recently learned. What do you do?",
    options: build([
      ["Teach anyway \u2014 it reinforces learning", 4],
      ["Help only if they insist", 1],
      ["Avoid until more confident", 2],
      ["Help only with what I'm sure of", 3],
    ]),
  },
  {
    id: "q6",
    label: "Q6/20",
    text: "You've been practising something for weeks with no improvement. What sustains you?",
    options: build([
      ["Habit", 3],
      ["Fear of falling behind", 1],
      ["Hope things will improve", 2],
      ["Desire for mastery", 4],
    ]),
  },
  {
    id: "q7",
    label: "Q7/20",
    text: "You get two free hours. What appeals more?",
    options: build([
      ["Completing something pending", 4],
      ["Starting something new", 2],
      ["Planning ahead", 3],
      ["Improving something ongoing", 1],
    ]),
  },
  {
    id: "q8",
    label: "Q8/20",
    text: "You notice a mistake after submitting an assignment. What do you do?",
    options: build([
      ["Let it go", 1],
      ["Understand the mistake", 4],
      ["Feel bad for a long time", 2],
      ["Ask for feedback or re-evaluation", 3],
    ]),
  },
  {
    id: "q9",
    label: "Q9/20",
    text: "Someone else does better than you. Your reaction?",
    options: build([
      ["\u201cLet me observe them.\u201d", 4],
      ["\u201cI'll find my own path.\u201d", 1],
      ["\u201cI must try harder.\u201d", 3],
      ["\u201cI'll go at my pace.\u201d", 2],
    ]),
  },
  {
    id: "q10",
    label: "Q10/20",
    text: "What makes you believe you'll succeed in 5 years?",
    options: build([
      ["Curiosity", 2],
      ["Consistency", 4],
      ["Adaptability", 3],
      ["Discipline", 4],
    ]),
  },
  {
    id: "q11",
    label: "Q11/20",
    title: "Meeting / Showing Up",
    text: "A client always makes you wait about 30 minutes. What do you do?",
    options: build([
      ["Reach on time", 2],
      ["Reach 5 minutes early", 4],
      ["Adjust and reach 30 minutes later", 3],
      ["Reconfirm the timing", 1],
    ]),
  },
  {
    id: "q12",
    label: "Q12/20",
    title: "Screen Time & Scrolling",
    text: "You say you'll scroll for 5 minutes but end up spending 30. Next time?",
    options: build([
      ["Accept it", 1],
      ["Use a timer", 3],
      ["Keep the phone out of reach", 4],
      ["Reduce daytime screen time", 2],
    ]),
  },
  {
    id: "q13",
    label: "Q13/20",
    title: "Instant Gratification",
    text: "You crave your favourite snack but you're on a fitness goal.",
    options: build([
      ["Eat it", 1],
      ["Eat half", 2],
      ["Delay it for a milestone", 4],
      ["Replace it with something healthier", 3],
    ]),
  },
  {
    id: "q14",
    label: "Q14/20",
    title: "Luck Perspective",
    text: "Something good happens unexpectedly. Your thought?",
    options: build([
      ["I was lucky", 1],
      ["It was bound to happen", 2],
      ["I created the right conditions", 3],
      ["Let me use this opportunity well", 4],
    ]),
  },
  {
    id: "q15",
    label: "Q15/20",
    title: "Fitness & Binge Eating",
    text: "After a stressful day, you usually:",
    options: build([
      ["Eat something comforting", 2],
      ["Distract myself with entertainment", 1],
      ["Exercise lightly", 4],
      ["Reflect and choose balanced food", 3],
    ]),
  },
  {
    id: "q16",
    label: "Q16/20",
    title: "Gratitude",
    text: "End of day thought?",
    options: build([
      ["Nothing special happened", 1],
      ["Some things went fine", 2],
      ["Thankful for at least one moment", 3],
      ["Many things to be grateful for", 4],
    ]),
  },
  {
    id: "q17",
    label: "Q17/20",
    title: "Humility",
    text: "When someone praises you:",
    options: build([
      ["\u201cI'm finally noticed.\u201d", 2],
      ["\u201cWish they knew the full story.\u201d", 1],
      ["\u201cStill lots to learn.\u201d", 4],
      ["\u201cThis is encouraging; I must improve.\u201d", 3],
    ]),
  },
  {
    id: "q18",
    label: "Q18/20",
    title: "Daily Habit Discipline",
    text: "On day 7 of a habit, you feel lazy.",
    options: build([
      ["Skip it", 1],
      ["Do the minimum possible", 3],
      ["Push through", 4],
      ["Simplify the habit", 2],
    ]),
  },
  {
    id: "q19",
    label: "Q19/20",
    title: "Delayed Rewards",
    text: "A long project shows no results until day 20.",
    options: build([
      ["\u201cThis isn't working.\u201d", 1],
      ["Slow down", 2],
      ["Progress will come", 4],
      ["Track differently", 3],
    ]),
  },
  {
    id: "q20",
    label: "Q20/20",
    title: "Competition vs Collaboration",
    text: "Someone asks for help during a competition.",
    options: build([
      ["Help fully", 4],
      ["Give a hint", 2],
      ["Help after you finish", 3],
      ["Don't help", 1],
    ]),
  },
];

export const BEHAVIOUR_QUESTION_IDS = BEHAVIOUR_QUESTIONS.map((q) => q.id);

/** Q21 — Age (answered from the dropdown). */
export const AGE_QUESTION: ChoiceQuestion = {
  id: "q21",
  label: "Q21",
  text: "What is your age?",
  options: build([
    ["18\u201324", 4],
    ["25\u201329", 4],
    ["30\u201334", 3],
    ["35\u201339", 3],
    ["40\u201344", 2],
    ["45\u201349", 2],
    ["50+", 1],
  ]),
};

/** Q23 — Which career path are you most likely to pursue? */
export const CAREER_PATH_QUESTION: ChoiceQuestion = {
  id: "q23",
  label: "Q23",
  text: "Which career path are you most likely to pursue?",
  options: build([
    ["Technology / Software / AI / Data", 4],
    ["Engineering / Manufacturing / Infrastructure", 3],
    ["Medicine / Healthcare / Life Sciences", 3],
    ["Finance / Investment / Banking / Insurance", 4],
    ["Business / Entrepreneurship / Trading", 4],
    ["Sales / Marketing / Media / Entertainment", 3],
    ["Professional Services / Consulting / Law / Accounting", 3],
    ["Government / Public Sector / Defence", 2],
    ["Education / Research / Academia", 2],
    ["Other / Undecided", 2],
  ]),
};

/** Q24 — Current starting financial base. */
export const FINANCIAL_BASE_QUESTION: ChoiceQuestion = {
  id: "q24",
  label: "Q24",
  text: "Current starting financial base",
  options: build([
    ["Little or no savings or assets, largely building from scratch", 1],
    ["Some personal savings or assets, but limited", 2],
    ["Reasonable financial base or some family support", 3],
    ["Substantial financial resources or support available", 4],
    ["Significant assets, investments or business ownership", 4],
  ]),
};

/** Q25 — Expected wealth-building route. */
export const WEALTH_ROUTE_QUESTION: ChoiceQuestion = {
  id: "q25",
  label: "Q25",
  text: "Expected wealth-building route",
  options: build([
    ["Primarily employment and salary growth", 2],
    ["Employment and investments", 3],
    ["Entrepreneurship or business ownership", 4],
    ["Professional practice or independent work", 3],
    ["Combination of employment, business and investments", 4],
    ["Not sure yet", 1],
  ]),
};

/** Q26 — Target horizon for US$1 million. */
export const TARGET_HORIZON_QUESTION: ChoiceQuestion = {
  id: "q26",
  label: "Q26",
  text: "If building a net worth equivalent to US$1 million is one of your goals, over what period would you aim to achieve it?",
  options: build([
    ["Within 5 years", 4],
    ["6\u20137 years", 4],
    ["8\u201310 years", 3],
    ["More than 10 years", 2],
    ["I have not set a specific timeframe", 1],
  ]),
};

/** Q27 — Current education / career stage. */
export const EDUCATION_QUESTION: ChoiceQuestion = {
  id: "q27",
  label: "Q27",
  text: "Current education or career stage",
  options: build([
    ["School", 3],
    ["Undergraduate", 4],
    ["Postgraduate", 4],
    ["Recently started working", 4],
    ["Working more than 3 years", 3],
    ["Business or entrepreneurship", 4],
    ["Other", 2],
  ]),
};

/** Q22 — Country Opportunity Index (already a 0–100 score, used directly). */
export const COI_COUNTRIES: { name: string; score: number }[] = [
  { name: "Switzerland", score: 96.2 },
  { name: "Sweden", score: 91.8 },
  { name: "United States", score: 90.8 },
  { name: "South Korea", score: 84.3 },
  { name: "Singapore", score: 93.7 },
  { name: "Netherlands", score: 91.6 },
  { name: "China", score: 57.4 },
  { name: "Japan", score: 86.1 },
  { name: "Canada", score: 86.4 },
  { name: "Austria", score: 87.4 },
  { name: "United Arab Emirates", score: 77.3 },
  { name: "Italy", score: 80.9 },
  { name: "Spain", score: 80.8 },
  { name: "Portugal", score: 79.3 },
  { name: "Malaysia", score: 71.8 },
  { name: "India", score: 49.8 },
  { name: "Saudi Arabia", score: 62.2 },
  { name: "Vietnam", score: 54.9 },
  { name: "Thailand", score: 60.9 },
  { name: "Qatar", score: 70.5 },
  { name: "Mauritius", score: 67.5 },
  { name: "Chile", score: 69.7 },
  { name: "Philippines", score: 50.8 },
  { name: "Brazil", score: 60.6 },
  { name: "Morocco", score: 50.2 },
  { name: "Indonesia", score: 56.7 },
  { name: "Jordan", score: 52.4 },
  { name: "South Africa", score: 49.0 },
  { name: "Bahrain", score: 62.1 },
  { name: "Mexico", score: 52.7 },
  { name: "Costa Rica", score: 66.7 },
  { name: "Kazakhstan", score: 60.3 },
  { name: "Egypt", score: 38.7 },
  { name: "Rwanda", score: 24.6 },
  { name: "Nigeria", score: 21.9 },
];

export const COI_QUESTION = {
  id: "q22",
  label: "Q22",
  text: "Country where you expect to build your career or business",
  hint: "Your selection sets your Country Opportunity Index (COI).",
};

/**
 * Q22 is rendered through the flagged country dropdown instead of the generic
 * option list, but it is registered as a regular choice question so the server
 * can validate all 27 answers through the same code path.
 */
export const COI_COUNTRY_QUESTION: ChoiceQuestion = {
  id: COI_QUESTION.id,
  label: COI_QUESTION.label,
  text: COI_QUESTION.text,
  options: COI_COUNTRIES.map((country) => ({ text: country.name, points: country.score })),
};

/** Every choice-based question, keyed by id (Q1–Q27). */
export const ALL_QUESTIONS: Record<string, ChoiceQuestion> = [
  ...BEHAVIOUR_QUESTIONS,
  AGE_QUESTION,
  COI_COUNTRY_QUESTION,
  CAREER_PATH_QUESTION,
  FINANCIAL_BASE_QUESTION,
  WEALTH_ROUTE_QUESTION,
  TARGET_HORIZON_QUESTION,
  EDUCATION_QUESTION,
].reduce<Record<string, ChoiceQuestion>>((acc, question) => {
  acc[question.id] = question;
  return acc;
}, {});

/** Question ids used by the Perseverance & Action dimension. */
export const PERSEVERANCE_IDS = ["q1", "q2", "q3", "q6", "q7", "q11", "q18", "q19"];

/** Question ids used by the Self-Mastery & Discipline dimension. */
export const SELF_MASTERY_IDS = ["q10", "q12", "q13", "q15"];

/** Question ids used by the Growth & Inner Mindset dimension. */
export const GROWTH_IDS = ["q4", "q5", "q8", "q9", "q14", "q16", "q17", "q20"];

/** The 27 answered questions, in order. */
export const QUESTION_ORDER = [
  ...BEHAVIOUR_QUESTION_IDS,
  "q21",
  "q22",
  "q23",
  "q24",
  "q25",
  "q26",
  "q27",
];

/**
 * Quiz pages.
 *
 *  - Pages 1–10: the 20 behaviour questions, two per page.
 *  - Page 11   : Q21–Q27 together on a SINGLE page (age, career country,
 *                career path, financial base, wealth route, target horizon and
 *                education stage). This is the client's requested layout, so all
 *                seven "about you" questions are answered in one pass.
 */
export const QUIZ_PAGES: { ids: string[] }[] = [
  { ids: ["q1", "q2"] },
  { ids: ["q3", "q4"] },
  { ids: ["q5", "q6"] },
  { ids: ["q7", "q8"] },
  { ids: ["q9", "q10"] },
  { ids: ["q11", "q12"] },
  { ids: ["q13", "q14"] },
  { ids: ["q15", "q16"] },
  { ids: ["q17", "q18"] },
  { ids: ["q19", "q20"] },
  { ids: ["q21", "q22", "q23", "q24", "q25", "q26", "q27"] },
];

export const TOTAL_PAGES = QUIZ_PAGES.length;

/**
 * The first page that still has an unanswered question.
 *
 * Used instead of a saved page number: a returning participant is dropped
 * straight onto the first question they have not answered yet, with no
 * "restoring" message in between.
 */
export function firstUnansweredPage(answers: Record<string, number>): number {
  for (let index = 0; index < QUIZ_PAGES.length; index += 1) {
    const ids = QUIZ_PAGES[index].ids;
    if (ids.some((id) => answers[id] === undefined)) return index + 1;
  }
  return TOTAL_PAGES;
}

/** The answer text chosen for one question, or "" when unanswered. */
export function answerText(id: string, answers: Record<string, number>): string {
  const question = ALL_QUESTIONS[id];
  const index = answers[id];
  if (!question || index === undefined) return "";
  return question.options[index]?.text ?? "";
}

/**
 * The 27 answers as plain text, keyed by sheet column ("Q1" … "Q27").
 *
 * This is what gets stored and logged — the participant's actual answer, not
 * the marks awarded for it.
 */
export function answerTexts(answers: Record<string, number>): Record<string, string> {
  const row: Record<string, string> = {};
  QUESTION_ORDER.forEach((id, index) => {
    row[`Q${index + 1}`] = answerText(id, answers);
  });
  return row;
}

/** The option index matching an answer text, or undefined when it does not match. */
export function answerIndex(id: string, text: string): number | undefined {
  const question = ALL_QUESTIONS[id];
  const needle = String(text ?? "").trim().toLowerCase();
  if (!question || !needle) return undefined;
  const index = question.options.findIndex((option) => option.text.trim().toLowerCase() === needle);
  return index >= 0 ? index : undefined;
}

/**
 * Rebuilds the answer indexes from a stored text row ("Q1" … "Q27").
 *
 * Used when an unfinished attempt comes back from the spreadsheet, where the
 * participant's answers are kept as text rather than marks.
 */
export function answersFromTexts(texts: Record<string, string>): Record<string, number> {
  const answers: Record<string, number> = {};
  QUESTION_ORDER.forEach((id, index) => {
    const resolved = answerIndex(id, texts[`Q${index + 1}`] ?? "");
    if (resolved !== undefined) answers[id] = resolved;
  });
  return answers;
}

/** ISO alpha-2 codes for the 35 COI countries, used only to render flags. */
const COI_COUNTRY_CODES: Record<string, string> = {
  Switzerland: "CH",
  Sweden: "SE",
  "United States": "US",
  "South Korea": "KR",
  Singapore: "SG",
  Netherlands: "NL",
  China: "CN",
  Japan: "JP",
  Canada: "CA",
  Austria: "AT",
  "United Arab Emirates": "AE",
  Italy: "IT",
  Spain: "ES",
  Portugal: "PT",
  Malaysia: "MY",
  India: "IN",
  "Saudi Arabia": "SA",
  Vietnam: "VN",
  Thailand: "TH",
  Qatar: "QA",
  Mauritius: "MU",
  Chile: "CL",
  Philippines: "PH",
  Brazil: "BR",
  Morocco: "MA",
  Indonesia: "ID",
  Jordan: "JO",
  "South Africa": "ZA",
  Bahrain: "BH",
  Mexico: "MX",
  "Costa Rica": "CR",
  Kazakhstan: "KZ",
  Egypt: "EG",
  Rwanda: "RW",
  Nigeria: "NG",
};

/** The 35 COI countries as Country objects, for the Q22 dropdown. */
export const COI_COUNTRY_OPTIONS = COI_COUNTRIES.map((country) => {
  const code = COI_COUNTRY_CODES[country.name] ?? "";
  return {
    code: code || country.name,
    name: country.name,
    flag: code ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : "",
  };
});
