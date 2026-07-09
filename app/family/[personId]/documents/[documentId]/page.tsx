import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENT_TYPE_CONFIG, PASSPORT_VALIDITY_LABELS, PASSPORT_VALIDITY_COLORS,
  getPassportValidity, formatExpiresAt,
} from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";

type DocumentDetail = {
  id: string;
  doc_type: DocumentType;
  label: string;
  expires_at: string | null;
  notes: string | null;
  details: DocumentDetails | null;
  storage_path: string;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
        {label}
      </div>
      <div className="text-sm font-light" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ personId: string; documentId: string }>;
}) {
  const { personId, documentId } = await params;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const { data: document } = await supabase
    .from("documents")
    .select("id, doc_type, label, expires_at, notes, details, storage_path")
    .eq("id", documentId)
    .eq("person_id", person.id)
    .maybeSingle();

  if (!document) notFound();
  const doc = document as unknown as DocumentDetail;
  const config = DOCUMENT_TYPE_CONFIG[doc.doc_type];
  const Icon = config.icon;
  const details = doc.details ?? {};

  const { data: signedUrlData } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 3600);

  const isImage = /\.(jpe?g|png|webp)$/i.test(doc.storage_path);
  const validity = doc.doc_type === "passport" ? getPassportValidity(doc) : null;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/family/${person.id}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {person.name}
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                {config.label}
              </span>
              {validity && (
                <span style={{ color: PASSPORT_VALIDITY_COLORS[validity], fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  · {PASSPORT_VALIDITY_LABELS[validity]}
                </span>
              )}
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {doc.label}
            </h1>
          </div>
          <Link
            href={`/family/${person.id}/documents/${doc.id}/edit`}
            style={{
              fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)",
              border: "1px solid rgba(184,154,94,0.3)", padding: "8px 16px", borderRadius: "20px", textDecoration: "none",
            }}
          >
            Bearbeiten
          </Link>
        </div>

        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <MetaItem label="Vorname" value={details.first_name ?? "—"} />
            <MetaItem label="Nachname" value={details.last_name ?? "—"} />
            <MetaItem label="Geburtsdatum" value={formatExpiresAt(details.birth_date ?? null)} />
            <MetaItem label={config.numberLabel} value={details.passport_number ?? "—"} />
            <MetaItem label="Ausstellungsland" value={details.issuing_country ?? "—"} />
            <MetaItem label="Ausstellungsdatum" value={formatExpiresAt(details.issue_date ?? null)} />
            <MetaItem label="Ablaufdatum" value={formatExpiresAt(doc.expires_at)} />
          </div>
        </div>

        {doc.notes && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Notizen
            </div>
            <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {doc.notes}
            </p>
          </div>
        )}

        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Hinterlegte Datei
          </div>
          {signedUrlData?.signedUrl ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrlData.signedUrl}
                alt={doc.label}
                className="rounded-lg w-full"
                style={{ maxHeight: 480, objectFit: "contain", background: "var(--background)" }}
              />
            ) : (
              <a
                href={signedUrlData.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)", fontSize: "0.8rem", textDecoration: "none" }}
              >
                PDF öffnen →
              </a>
            )
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Datei konnte nicht geladen werden.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
