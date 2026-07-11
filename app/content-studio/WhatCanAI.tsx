import { Sparkles } from "lucide-react";

const EXAMPLES = [
  "Aus einem Strandfoto wird ein fertiges Reel-Skript mit Hook und Szenenfolge.",
  "Aus eurem Reiseverlauf wird eine Story-Serie für einen einzelnen Tag.",
  "Aus einer Aktivität wird eine Caption inklusive passender Hashtags.",
];

/** Ersetzt eine leere, unmotivierte "Noch keine Ideen"-Zeile durch konkrete Beispiele, was die KI hier eigentlich kann. */
export function WhatCanAI() {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 400 }}>Was kann die KI?</span>
      </div>
      <ul className="space-y-2">
        {EXAMPLES.map((text) => (
          <li key={text} style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
