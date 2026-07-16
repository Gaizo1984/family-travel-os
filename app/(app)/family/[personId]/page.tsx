import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENT_TYPE_CONFIG, PASSPORT_VALIDITY_LABELS, PASSPORT_VALIDITY_COLORS,
  getPassportValidity, formatExpiresAt,
} from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { TRAVEL_NEED_OPTIONS } from "@/lib/family-dna";
import { buildTravelWorld } from "@/lib/travel-world";
import { getFamily } from "@/lib/family";
import { getPhotoDisplayUrl, getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { WorldMap } from "@/components/WorldMap";
import { Map as MapIcon, Globe } from "lucide-react";

const TRAVEL_NEED_LABELS: Record<string, string> = Object.fromEntries(
  TRAVEL_NEED_OPTIONS.map((o) => [o.key, o.label]),
);

type DocumentRow = {
  id: string;
  doc_type: DocumentType;
  label: string;
  expires_at: string | null;
  details: DocumentDetails | null;
};

function DocumentRowItem({ doc, personId }: { doc: DocumentRow; personId: string }) {
  const config = DOCUMENT_TYPE_CONFIG[doc.doc_type];
  const Icon = config.icon;
  const validity = doc.doc_type === "passport" ? getPassportValidity(doc) : null;

  return (
    <Link
      href={`/family/${personId}/documents/${doc.id}`}
      className="flex items-center gap-4 p-4 rounded-xl transition-colors"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-lg"
        style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}
      >
        <Icon size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{doc.label}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
          {config.label}{doc.expires_at ? ` · gültig bis ${formatExpiresAt(doc.expires_at)}` : ""}
        </div>
      </div>
      {validity && (
        <div
          className="text-right shrink-0"
          style={{ color: PASSPORT_VALIDITY_COLORS[validity], fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          {PASSPORT_VALIDITY_LABELS[validity]}
        </div>
      )}
    </Link>
  );
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name, initials, color, role_label, description, interest_tags, travel_needs, photo_storage_path")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const { id: familyId } = await getFamily();

  // §Performance-Audit: vier voneinander unabhängige Ladevorgänge (alle
  // brauchen nur person.id/photo_storage_path) liefen bisher seriell.
  // §"Egress-Analyse 2026-07-16": 40px-Avatar + 1/1-Grid -- Thumbnails statt Originale, gecachte Signed URLs.
  const [resolvedPhoto, { data: documents }, personWorldStats, { data: memoryPhotosRaw }] = await Promise.all([
    person.photo_storage_path
      ? getPhotoDisplayUrl("documents", person.photo_storage_path, "thumb400")
      : Promise.resolve(null),
    supabase.from("documents").select("id, doc_type, label, expires_at, details").eq("person_id", person.id).order("created_at", { ascending: true }),
    buildTravelWorld({ familyId, personId: person.id }),
    supabase.from("memory_photos").select("id, storage_path, caption, taken_at, created_at").eq("uploaded_by_person_id", person.id).order("taken_at", { ascending: false, nullsFirst: false }).limit(12),
  ]);
  const photoUrl = resolvedPhoto?.url ?? null;
  const docs = (documents ?? []) as unknown as DocumentRow[];

  const memoryPhotosDisplayByPath = await getPhotoDisplayUrls("documents", (memoryPhotosRaw ?? []).map((p) => p.storage_path), "thumb400");
  const memoryPhotos = (memoryPhotosRaw ?? []).map((p) => ({ ...p, url: memoryPhotosDisplayByPath.get(p.storage_path)?.url ?? null }));

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
          <div className="flex items-center gap-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={person.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em" }}
              >
                {person.initials}
              </div>
            )}
            <div>
              <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}>
                {person.name}
              </h1>
              {person.role_label && (
                <p style={{ color: "var(--muted)", fontSize: "0.72rem", letterSpacing: "0.04em" }}>{person.role_label}</p>
              )}
            </div>
          </div>
          <Link
            href={`/family/${person.id}/edit`}
            style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
          >
            Profil bearbeiten →
          </Link>
        </div>

        {(person.description || person.interest_tags.length > 0 || person.travel_needs.length > 0) && (
          <div className="rounded-xl p-6 mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {person.description && (
              <p className="mb-4" style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, lineHeight: 1.6 }}>
                {person.description}
              </p>
            )}
            {person.interest_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {person.interest_tags.map((tag) => (
                  <span key={tag} style={{ color: "var(--accent)", fontSize: "0.62rem", letterSpacing: "0.06em", background: "rgba(184,154,94,0.1)", border: "1px solid rgba(184,154,94,0.25)", padding: "3px 10px", borderRadius: "20px" }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {person.travel_needs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {person.travel_needs.map((need) => (
                  <span key={need} style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.06em", background: "var(--background)", border: "1px solid var(--border)", padding: "3px 10px", borderRadius: "20px" }}>
                    {TRAVEL_NEED_LABELS[need] ?? need}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {personWorldStats.tripsCount > 0 && (
          <section className="mb-8">
            <h2
              className="text-xs font-medium mb-5"
              style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
            >
              Diese Reisewelt
            </h2>
            <div className="flex gap-10 mb-5">
              {[
                { Icon: MapIcon, value: personWorldStats.tripsCount, label: "Reisen" },
                { Icon: Globe, value: personWorldStats.countryCodes.size, label: "Länder" },
              ].map(({ Icon, value, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div>
                    <div className="text-2xl font-light leading-none mb-0.5" style={{ color: "var(--foreground)" }}>{value}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <WorldMap visitedCodes={personWorldStats.countryCodes} />
            </div>
          </section>
        )}

        {memoryPhotos.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Erinnerungen
              </h2>
              <Link href="/memories" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
                Alle Erinnerungen →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {memoryPhotos.map((p) => p.url && (
                <div key={p.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-xs font-medium"
              style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
            >
              Reisedokumente{docs.length > 0 ? ` · ${docs.length}` : ""}
            </h2>
            <Link
              href={`/family/${person.id}/documents/new?type=passport`}
              style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
            >
              + Dokument hinzufügen
            </Link>
          </div>

          {docs.length > 0 ? (
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocumentRowItem key={doc.id} doc={doc} personId={person.id} />
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Noch keine Reisedokumente hinterlegt.
              </p>
              <Link
                href={`/family/${person.id}/documents/new?type=passport`}
                style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                Reisepass hinzufügen →
              </Link>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
