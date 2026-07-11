/**
 * Gemeinsame Fehler-/Erfolgs-Banner-Komponente — war zuvor an >25 Stellen der
 * App wortwörtlich copy-paste-dupliziert (identische Farbwerte/Styles je
 * Formularseite). Eine Quelle der Wahrheit für dieses Muster.
 */
const VARIANT_STYLE: Record<"error" | "success", React.CSSProperties> = {
  error: { background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A" },
  success: { background: "rgba(107,143,113,0.12)", border: "1px solid rgba(107,143,113,0.3)", color: "#6B8F71" },
};

export function Banner({
  variant,
  children,
  className = "mb-6 px-4 py-3 rounded-lg",
}: {
  variant: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ ...VARIANT_STYLE[variant], fontSize: "0.75rem", letterSpacing: "0.02em" }}>
      {children}
    </div>
  );
}
