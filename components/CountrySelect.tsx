"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./CountrySelect.module.css";
import type { Country } from "@/lib/countries";

type Props = {
  value: string;
  onChange: (value: string) => void;
  countries: Country[];
  placeholder?: string;
  inputId?: string;
  /** Notified on every open/close so the parent can raise its card if needed. */
  onOpenChange?: (open: boolean) => void;
};

/**
 * Searchable dropdown showing each country with its flag.
 * Used both for Q22 (35 COI countries) and for Country of Residence (all).
 *
 * Layering: the trigger sits inside a `.card`, so the panel is absolutely
 * positioned inside `.wrap` (which establishes the positioning context). The
 * card that owns the open panel is lifted with `:focus-within` in the page CSS,
 * and the panel flips upward when there is not enough room below.
 */
export default function CountrySelect({
  value,
  onChange,
  countries,
  placeholder = "Select a country",
  inputId,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => countries.find((c) => c.name.toLowerCase() === value.trim().toLowerCase()) ?? null,
    [countries, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(needle));
  }, [countries, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDropUp(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const openPanel = () => {
    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Flip upward when the 340px panel would otherwise overflow the viewport.
      setDropUp(spaceBelow < 340 && rect.top > spaceBelow);
    }
    setOpen(true);
    onOpenChange?.(true);
  };

  const pick = (name: string) => {
    onChange(name);
    close();
  };

  // Focus the search box only once the panel exists (more reliable than
  // `autoFocus`, which can scroll or zoom the page on mobile).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div className={`${styles.wrap} ${open ? styles.wrapOpen : ""}`} ref={boxRef}>
      <button
        type="button"
        id={inputId}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => (open ? close() : openPanel())}
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
        <div className={`${styles.panel} ${dropUp ? styles.panelUp : ""}`}>
          <input
            ref={searchRef}
            className={styles.search}
            placeholder="Type to search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const first = filtered[0];
                if (first) pick(first.name);
              }
            }}
          />
          <ul className={styles.list} role="listbox">
            {filtered.map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.code === country.code}
                  className={`${styles.item} ${selected?.code === country.code ? styles.itemActive : ""}`}
                  onClick={() => pick(country.name)}
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
