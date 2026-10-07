import Link from "next/link";

import { INTRODUCTION, INTRODUCTION_TITLE } from "@/lib/content";

import styles from "./home.module.css";

export default function HomePage() {
  return (
    <div className={`app-canvas ${styles.page}`}>
      <div className={styles.wrap}>
        <section className={`card ${styles.hero}`}>
          <h1 className={styles.title}>{INTRODUCTION_TITLE}</h1>

          <div className={styles.intro}>
            {INTRODUCTION.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className={styles.lead}>
                {paragraph}
              </p>
            ))}
          </div>

          <Link href="/quiz" className={styles.cta}>
            Start the assessment
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </section>
      </div>
    </div>
  );
}

