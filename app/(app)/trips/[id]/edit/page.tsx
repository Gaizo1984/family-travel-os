import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateTrip } from "@/lib/actions/trips";
import { Banner } from "@/components/Banner";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "planned",   label: "Geplant" },
  { value: "active",    label: "Aktiv" },
  { value: "completed", label: "Abgeschlossen" },
];

type TripRow = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  status: string
  start_date: string | null
  end_date: string | null
  trip_members: Array<{ person_id: string }>
}

export default async function EditTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const { data } = await supabase
    .from("trips")
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      trip_members ( person_id )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!data) notFound();
  const trip = data as unknown as TripRow;

  const { data: persons } = await supabase
    .from("persons")
    .select("id, name, initials, color")
    .order("name");

  const memberIds = new Set(trip.trip_members.map((m) => m.person_id));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div
          style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}
        >
          Reise bearbeiten
        </div>
        <h1
          className="font-light mb-8"
          style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}
        >
          {trip.title}
        </h1>

        <form action={updateTrip}>
          <input type="hidden" name="trip_id" value={trip.id} />

          <div
            className="rounded-xl p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            {/* Reisenname */}
            <div className="mb-5">
              <label
                htmlFor="edit-title"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Reisenname *
              </label>
              <input
                id="edit-title"
                name="title"
                type="text"
                required
                defaultValue={trip.title}
                style={{
                  width: "100%", padding: "12px 16px", background: "var(--background)",
                  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
                  fontSize: "0.9rem", fontWeight: 300, outline: "none",
                }}
              />
            </div>

            {/* Untertitel */}
            <div className="mb-5">
              <label
                htmlFor="edit-subtitle"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Untertitel
              </label>
              <input
                id="edit-subtitle"
                name="subtitle"
                type="text"
                defaultValue={trip.subtitle ?? ""}
                placeholder="z. B. Guanacaste · La Fortuna · Osa Peninsula"
                style={{
                  width: "100%", padding: "12px 16px", background: "var(--background)",
                  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
                  fontSize: "0.9rem", fontWeight: 300, outline: "none",
                }}
              />
            </div>

            {/* Daten */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label
                  htmlFor="edit-start"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Von *
                </label>
                <input
                  id="edit-start"
                  name="start_date"
                  type="date"
                  required
                  defaultValue={trip.start_date ?? ""}
                  style={{
                    width: "100%", padding: "12px 16px", background: "var(--background)",
                    border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
                    fontSize: "0.88rem", outline: "none",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-end"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Bis *
                </label>
                <input
                  id="edit-end"
                  name="end_date"
                  type="date"
                  required
                  defaultValue={trip.end_date ?? ""}
                  style={{
                    width: "100%", padding: "12px 16px", background: "var(--background)",
                    border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
                    fontSize: "0.88rem", outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="mb-8">
              <label
                htmlFor="edit-status"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Status
              </label>
              <select
                id="edit-status"
                name="status"
                defaultValue={trip.status}
                style={{
                  width: "100%", padding: "12px 16px", background: "var(--background)",
                  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
                  fontSize: "0.88rem", outline: "none",
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Mitreisende */}
            <div className="mb-8">
              <div
                style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "12px" }}
              >
                Wer reist mit *
              </div>
              <div className="flex flex-wrap gap-3">
                {(persons ?? []).map((p) => (
                  <label
                    key={p.id}
                    style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      name="members"
                      value={p.id}
                      defaultChecked={memberIds.has(p.id)}
                      style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>
                      {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link
                href={`/trips/${trip.slug}`}
                style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
              >
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none",
                  borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                  letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                  whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Änderungen speichern
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
