import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { getHouseholdMemberById } from "@/lib/household-members";
import { updateDocument } from "@/lib/actions/documents";
import { extractDocumentData } from "@/lib/actions/document-extraction";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { DocumentForm } from "../../DocumentForm";

type DraftFields = {
  readable?: boolean;
  detected_name?: string | null;
  expires_at?: string | null;
} & Record<string, string | null | boolean | undefined>;

export default async function EditDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string; documentId: string }>;
  searchParams: Promise<{ error?: string; draft?: string; storage_path?: string }>;
}) {
  const { personId, documentId } = await params;
  const { error, draft: draftRaw, storage_path } = await searchParams;

  let draft: DraftFields | null = null;
  if (draftRaw) {
    try { draft = JSON.parse(draftRaw) as DraftFields; } catch { draft = null; }
  }

  const lumiCore = await createLumiCoreClient();
  // §ID-Space: /family/[personId] ist die echte household_member_id.
  const householdMemberId = personId;

  const member = await getHouseholdMemberById(householdMemberId);
  if (!member) notFound();
  const person = { id: personId, name: member.name };

  const { data: document } = await lumiCore
    .from("travel_documents")
    .select("id, doc_type, label, expires_at, notes, details")
    .eq("id", documentId)
    .eq("household_member_id", householdMemberId)
    .maybeSingle();

  if (!document) notFound();

  const existingDetails = (document.details as DocumentDetails | null) ?? {};
  const mergedDetails: DocumentDetails = draft
    ? {
        ...existingDetails,
        ...Object.fromEntries(
          Object.entries(draft)
            .filter(([key, value]) => key !== "readable" && key !== "detected_name" && key !== "expires_at" && value != null)
        ),
      }
    : existingDetails;
  const mergedExpiresAt = draft?.expires_at ?? document.expires_at;

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
          extractAction={extractDocumentData}
          hiddenFields={{
            document_id: document.id,
            // §ID-Space-Fix: `updateDocument` (lib/actions/documents.ts) schreibt
            // dieses Feld direkt in travel_documents.household_member_id -- muss
            // die aufgelöste Lumi-Core-ID sein, nicht Travels legacy personId
            // (der Routen-Parameter). `return_to` unten stellt sicher, dass der
            // interne Redirect-Fallback der Action (der sonst dieselbe ID fälschlich
            // als /family/[personId]-Segment verwenden würde) nie greift.
            person_id: householdMemberId,
            mode: "edit",
            return_to: `/family/${person.id}/documents/${document.id}`,
          }}
          defaultType={document.doc_type as DocumentType}
          fileRequired={false}
          existingStoragePath={storage_path}
          infoMessage={draft ? "Automatisch ausgelesen — bereits gespeicherte Felder, die die KI nicht erkennen konnte, bleiben unverändert. Bitte prüfen und erst dann speichern." : undefined}
          detectedName={draft?.detected_name ?? undefined}
          submitLabel="Änderungen speichern"
          cancelHref={`/family/${person.id}/documents/${document.id}`}
          errorMessage={error}
          values={{
            label: document.label ?? "",
            doc_type: document.doc_type as DocumentType,
            expires_at: mergedExpiresAt,
            notes: document.notes,
            details: mergedDetails,
          }}
        />

        <div
          className="rounded-xl p-6 mt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Dokument endgültig entfernen (Person, Reisen und Buchungen bleiben erhalten).
          </p>
          <Link
            href={`/family/${person.id}/documents/${document.id}/delete`}
            style={{
              background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
              borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em",
              textTransform: "uppercase", whiteSpace: "nowrap", textDecoration: "none",
            }}
          >
            Dokument löschen
          </Link>
        </div>
      </div>
    </div>
  );
}
