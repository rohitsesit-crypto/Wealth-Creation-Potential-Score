"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./CountrySelect.module.css";
import type { Country } from "@/lib/countries";

type Props = {
  value: string;
  onChange: (value: string) => void;
  countries: Country[];
  placeholder?: string;
  inputId?: string;
};

/**
 * Searchable dropdown showing each country with its flag.
 * Used both for Q22 (35 COI countries) and for Country of Residence (all).
 */
export default function CountrySelect({ value, onChange, countries, placeholder = "Select a country", inputId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => countries.find((c) => c.name.toLowerCase() === value.trim().toLowerCase()) ?? null,
    [countries, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(needle));
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className={styles.wrap} ref={boxRef}>
      <button
        type="button"
        id={inputId}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className={styles.value}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.flag} alt="" className={styles.flag} />
            {selected.name}
          </span>
        ) : (
          <span className={styles.placeholder}>{value || placeholder}</span>
        )}
        <svg className={styles.caret} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={styles.panel}>
          <input
            autoFocus
            className={styles.search}
            placeholder="Type to search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className={styles.list} role="listbox">
            {filtered.map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.code === country.code}
                  className={`${styles.item} ${selected?.code === country.code ? styles.itemActive : ""}`}
                  onClick={() => {
                    onChange(country.name);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={country.flag} alt="" className={styles.flag} />
                  <span>{country.name}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className={styles.empty}>No country found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
