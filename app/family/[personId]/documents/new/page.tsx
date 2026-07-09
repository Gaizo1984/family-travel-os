import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createDocument } from "@/lib/actions/documents";
import { DOCUMENT_TYPE_ORDER, DOCUMENT_TYPE_CONFIG } from "@/lib/documents";
import type { DocumentType } from "@/lib/documents";
import { DocumentForm } from "../DocumentForm";

export default async function NewDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ type?: string; return_to?: string; assign_trip?: string; error?: string }>;
}) {
  const { personId } = await params;
  const { type, return_to, assign_trip, error } = await searchParams;

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
          hiddenFields={{
            person_id: person.id,
            ...(return_to ? { return_to } : {}),
            ...(assign_trip ? { assign_trip } : {}),
          }}
          defaultType={config.value}
          fileRequired
          submitLabel="Dokument speichern"
          cancelHref={cancelHref}
          errorMessage={error}
        />
      </div>
    </div>
  );
}
