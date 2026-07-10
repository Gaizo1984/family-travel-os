import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type TimelineEntry = {
  key: string;
  year: number | null;
  title: string;
  subtitle: string;
  isPast: boolean;
  editHref: string | null;
};

export default async function FamilyHistoryPage() {
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const familyId = family?.id ?? "";

  const [{ data: trips }, { data: pastTrips }] = await Promise.all([
    supabase.from("trips").select("id, slug, title, start_date, status").eq("family_id", familyId).order("start_date"),
    supabase.from("past_trips").select("id, country_or_region, year, places, duration_days, note").eq("family_id", familyId).order("year"),
  ]);

  const entries: TimelineEntry[] = [
    ...(trips ?? [])
      .filter((t) => t.status === "completed" || t.status === "active")
      .map((t) => ({
        key: `trip-${t.id}`,
        year: t.start_date ? new Date(t.start_date).getFullYear() : null,
        title: t.title,
        subtitle: t.status === "active" ? "Aktuelle Reise" : "In Family Travel OS geplant",
        isPast: false,
        editHref: null,
      })),
    ...(pastTrips ?? []).map((p) => ({
      key: `past-${p.id}`,
      year: p.year,
      title: p.country_or_region,
      subtitle: [p.places, p.duration_days ? `${p.duration_days} Tage` : null].filter(Boolean).join(" · ") || "Manuell erfasst",
      isPast: true,
      editHref: `/family/history/${p.id}/edit`,
    })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Familie
        </Link>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
            Unsere Reisegeschichte
          </h1>
          <Link
            href="/family/history/new"
            style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
          >
            + Reise ergänzen
          </Link>
        </div>

        {entries.length > 0 ? (
          <div className="rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {entries.map((entry, idx) => (
              <div
                key={entry.key}
                className="flex items-center justify-between gap-4 p-5"
                style={{ borderBottom: idx < entries.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="flex items-center gap-4">
                  <div style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", width: 44 }}>
                    {entry.year ?? "—"}
                  </div>
                  <div>
                    <div style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400 }}>{entry.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{entry.subtitle}</div>
                  </div>
                </div>
                {entry.editHref && (
                  <Link href={entry.editHref} style={{ color: "var(--muted)", fontSize: "0.68rem", textDecoration: "none" }}>
                    Bearbeiten
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Noch keine Reisegeschichte erfasst.</p>
          </div>
        )}
      </div>
    </div>
  );
}
