import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PersonRow = { id: string; name: string; initials: string; color: string };

export default async function TripDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select(`
      id, slug, title,
      trip_members ( persons ( id, name, initials, color ) )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const members = (trip.trip_members as unknown as Array<{ persons: PersonRow | null }>)
    .flatMap((tm) => (tm.persons ? [tm.persons] : []));

  const memberIds = members.map((m) => m.id);
  const { data: passports } = memberIds.length > 0
    ? await supabase
        .from("documents")
        .select("id, person_id")
        .eq("doc_type", "passport")
        .in("person_id", memberIds)
    : { data: [] };

  const passportByPerson = new Map<string, string>();
  for (const p of passports ?? []) {
    if (p.person_id && !passportByPerson.has(p.person_id)) passportByPerson.set(p.person_id, p.id);
  }

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Dokumente
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Reisedokumente der Mitreisenden
        </h1>

        {members.length > 0 ? (
          <div className="space-y-2">
            {members.map((person) => {
              const documentId = passportByPerson.get(person.id);
              const returnTo = `/trips/${trip.slug}/documents`;
              return (
                <div
                  key={person.id}
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.04em" }}
                  >
                    {person.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{person.name}</div>
                    <div
                      className="text-xs mt-0.5 flex items-center gap-1.5"
                      style={{ color: documentId ? "var(--muted)" : "#B5624A", fontSize: "0.7rem" }}
                    >
                      {documentId && <BadgeCheck size={12} strokeWidth={1.5} />}
                      {documentId ? "Reisepass hinterlegt" : "Reisepass fehlt"}
                    </div>
                  </div>
                  <Link
                    href={documentId
                      ? `/family/${person.id}/documents/${documentId}`
                      : `/family/${person.id}/documents/new?type=passport&return_to=${encodeURIComponent(returnTo)}`}
                    style={{
                      fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
                      border: "1px solid rgba(184,154,94,0.3)", padding: "7px 14px", borderRadius: "20px",
                      textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                    }}
                  >
                    {documentId ? "Ansehen" : "Ergänzen"}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Für diese Reise sind noch keine Mitreisenden ausgewählt.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
