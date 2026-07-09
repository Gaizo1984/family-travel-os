import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createDocument } from "@/lib/actions/documents";
import { extractDocumentData } from "@/lib/actions/document-extraction";
import { DOCUMENT_TYPE_ORDER, DOCUMENT_TYPE_CONFIG } from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { DocumentForm } from "../DocumentForm";

type DraftFields = {
  readable?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  detected_name?: string | null;
  expires_at?: string | null;
} & Record<string, string | null | boolean | undefined>;

export default async function NewDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ type?: string; return_to?: string; assign_trip?: string; error?: string; draft?: string; storage_path?: string }>;
}) {
  const { personId } = await params;
  const { type, return_to, assign_trip, error, draft: draftRaw, storage_path } = await searchParams;

  let draft: DraftFields | null = null;
  if (draftRaw) {
    try { draft = JSON.parse(draftRaw) as DraftFields; } catch { draft = null; }
  }

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const cancelHref = return_to || `/family/${person.id}`;
  const config = type ? DOCUMENT_TYPE_CONFIG[type as DocumentType] : undefined;
  const isSelectable = config && DOCUMENT_TYPE_ORDER.includes(config.value);

  const passthrough = new URLSearchParams();
  if (return_to) passthrough.set("return_to", return_to);
  if (assign_trip) passthrough.set("assign_trip", assign_trip);

  if (!isSelectable) {
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
            Was möchtest du erfassen?
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DOCUMENT_TYPE_ORDER.map((key) => {
              const c = DOCUMENT_TYPE_CONFIG[key];
              const Icon = c.icon;
              const params = new URLSearchParams(passthrough);
              params.set("type", key);
              return (
                <Link
                  key={key}
                  href={`/family/${person.id}/documents/new?${params.toString()}`}
                  className="rounded-xl p-5 flex flex-col items-center gap-3 text-center transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <Icon size={20} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>{c.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const backParams = new URLSearchParams(passthrough);
  const backHref = `/family/${person.id}/documents/new${backParams.toString() ? `?${backParams.toString()}` : ""}`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={backHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Dokumenttyp ändern
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          {config.label}
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Neues Dokument für {person.name}
        </h1>

        <DocumentForm
          action={createDocument}
          extractAction={extractDocumentData}
          hiddenFields={{
            person_id: person.id,
            mode: "create",
            ...(return_to ? { return_to } : {}),
            ...(assign_trip ? { assign_trip } : {}),
          }}
          defaultType={config.value}
          fileRequired={!storage_path}
          existingStoragePath={storage_path}
          infoMessage={draft ? "Automatisch ausgelesen — bitte prüfen und bei Bedarf korrigieren." : undefined}
          detectedName={draft?.detected_name ?? undefined}
          values={draft ? {
            label: [config.label, draft.first_name, draft.last_name].filter(Boolean).join(" ") || `${config.label} ${person.name}`,
            doc_type: config.value,
            expires_at: (draft.expires_at as string | null) ?? null,
            notes: null,
            details: draft as unknown as DocumentDetails,
          } : undefined}
          submitLabel="Dokument speichern"
          cancelHref={cancelHref}
          errorMessage={error}
        />
      </div>
    </div>
  );
}
