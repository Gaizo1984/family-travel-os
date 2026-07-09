import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createDocument } from "@/lib/actions/documents";
import { DOCUMENT_TYPE_CONFIG } from "@/lib/documents";
import type { DocumentType } from "@/lib/documents";
import { DocumentForm } from "../DocumentForm";

export default async function NewDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ type?: string; return_to?: string; error?: string }>;
}) {
  const { personId } = await params;
  const { type, return_to, error } = await searchParams;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const defaultType = (type && DOCUMENT_TYPE_CONFIG[type as DocumentType] ? type : "passport") as DocumentType;
  const cancelHref = return_to || `/family/${person.id}`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={cancelHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {person.name}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Dokument hinzufügen
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Neues Reisedokument für {person.name}
        </h1>

        <DocumentForm
          action={createDocument}
          hiddenFields={{ person_id: person.id, ...(return_to ? { return_to } : {}) }}
          defaultType={defaultType}
          fileRequired
          submitLabel="Dokument speichern"
          cancelHref={cancelHref}
          errorMessage={error}
        />
      </div>
    </div>
  );
}
