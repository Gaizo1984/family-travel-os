import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENT_TYPE_CONFIG, PASSPORT_VALIDITY_LABELS, PASSPORT_VALIDITY_COLORS,
  getPassportValidity, formatExpiresAt,
} from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";

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
    .select("id, name, initials, color")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, doc_type, label, expires_at, details")
    .eq("person_id", person.id)
    .order("created_at", { ascending: true });

  const docs = (documents ?? []) as unknown as DocumentRow[];

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

        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em" }}
          >
            {person.initials}
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}>
            {person.name}
          </h1>
        </div>

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
