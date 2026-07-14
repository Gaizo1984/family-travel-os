'use client'

import Link from "next/link";
import { useRef, useState } from "react";

export type WorldMapPanel = {
  key: string;
  label: string;
  initials: string;
  color: string | null;
  href: string;
  node: React.ReactNode;
};

/**
 * Client-Wrapper um serverseitig vorgerenderte `<WorldMap>`-Instanzen (die
 * Komponente selbst braucht `fs`, kann also nicht hier drin laufen) --
 * übernimmt nur den Swipe-/Dot-Wechsel zwischen Gesamt- und Personenkarten.
 */
export function WorldMapCarousel({ panels }: { panels: WorldMapPanel[] }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (panels.length === 0) return null;
  const current = panels[Math.min(index, panels.length - 1)];

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const threshold = 40;
    if (deltaX > threshold) setIndex((i) => Math.max(0, i - 1));
    else if (deltaX < -threshold) setIndex((i) => Math.min(panels.length - 1, i + 1));
  }

  return (
    <div>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ touchAction: "pan-y" }}>
        <Link href={current.href} className="block rounded-xl p-4 transition-opacity hover:opacity-90" style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
          {current.node}
        </Link>
      </div>

      {panels.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {panels.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={p.label}
              className="flex items-center justify-center"
              style={{
                width: 22, height: 22, borderRadius: "50%", padding: 0, cursor: "pointer",
                background: i === index ? (p.color ?? "var(--accent)") : "var(--surface)",
                border: i === index ? "1px solid transparent" : "1px solid var(--border)",
                color: i === index ? "#F0EBE3" : "var(--muted)",
                fontSize: "0.55rem", letterSpacing: "0.02em", opacity: i === index ? 1 : 0.7,
                transition: "all 0.2s",
              }}
            >
              {p.initials}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center mt-2">
        <span style={{ color: "var(--muted)", fontSize: "0.66rem", letterSpacing: "0.06em" }}>{current.label}</span>
      </div>
    </div>
  );
}
