import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { getHouseholdMemberById } from "@/lib/household-members";
import { deleteDocument } from "@/lib/actions/documents";

export default async function DeleteDocumentPage({
  params,
}: {
  params: Promise<{ personId: string; documentId: string }>;
}) {
  const { personId, documentId } = await params;

  const lumiCore = await createLumiCoreClient();
  // §ID-Space: /family/[personId] ist die echte household_member_id.
  const householdMemberId = personId;

  const member = await getHouseholdMemberById(householdMemberId);
  if (!member) notFound();
  const person = { id: personId, name: member.name };

  const { data: document } = await lumiCore
    .from("travel_documents")
    .select("id, label, storage_path")
    .eq("id", documentId)
    .eq("household_member_id", householdMemberId)
    .maybeSingle();

  if (!document || !document.label || !document.storage_path) notFound();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/family/${person.id}/documents/${document.id}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {document.label}
        </Link>

        <div
          className="rounded-xl p-8"
          style={{ background: "var(--surface)", border: "1px solid rgba(181,98,74,0.3)" }}
        >
          <div style={{ color: "#B5624A", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Dokument löschen
          </div>
          <h1 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}>
            &bdquo;{document.label}&rdquo; wirklich löschen?
          </h1>
          <p className="leading-relaxed mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Das Dokument inkl. hinterlegter Datei wird entfernt. Person, Reisen und Buchungen bleiben unverändert erhalten.
          </p>

          <form action={deleteDocument} className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <input type="hidden" name="document_id" value={document.id} />
            <input type="hidden" name="person_id" value={person.id} />
            <input type="hidden" name="storage_path" value={document.storage_path} />
            <Link
              href={`/family/${person.id}/documents/${document.id}/edit`}
              style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              style={{
                background: "#B5624A", color: "#F0EBE3", border: "none",
                borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
              }}
            >
              Ja, löschen
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
