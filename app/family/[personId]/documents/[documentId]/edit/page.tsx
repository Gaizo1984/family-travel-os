import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateDocument } from "@/lib/actions/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { DocumentForm } from "../../DocumentForm";

export default async function EditDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string; documentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { personId, documentId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const { data: document } = await supabase
    .from("documents")
    .select("id, doc_type, label, expires_at, notes, details")
    .eq("id", documentId)
    .eq("person_id", person.id)
    .maybeSingle();

  if (!document) notFound();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/family/${person.id}/documents/${document.id}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {document.label}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Dokument bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {document.label}
        </h1>

        <DocumentForm
          action={updateDocument}
          hiddenFields={{ document_id: document.id, person_id: person.id }}
          defaultType={document.doc_type as DocumentType}
          fileRequired={false}
          submitLabel="Änderungen speichern"
          cancelHref={`/family/${person.id}/documents/${document.id}`}
          errorMessage={error}
          values={{
            label: document.label ?? "",
            doc_type: document.doc_type as DocumentType,
            expires_at: document.expires_at,
            notes: document.notes,
            details: document.details as DocumentDetails | null,
          }}
        />
      </div>
    </div>
  );
}
