/**
 * Einfacher, wiederverwendbarer Platzhalter-Baustein für loading.tsx-Skeletons
 * — kein neues Design-System, nur ein pulsierender Block in Kartenoptik, den
 * alle Route-Skeletons zusammensetzen.
 */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", ...style }}
    />
  );
}
