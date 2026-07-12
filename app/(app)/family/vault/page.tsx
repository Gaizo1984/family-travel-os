import Link from "next/link";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENT_TYPE_CONFIG, DOCUMENT_VALIDITY_LABELS, DOCUMENT_VALIDITY_COLORS,
  getDocumentValidity,
} from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";

type PersonRow = { id: string; name: string; initials: string };
type DocumentRow = {
  id: string;
  person_id: string;
  doc_type: DocumentType;
  label: string;
  expires_at: string | null;
  details: DocumentDetails | null;
};
type PolicyRow = {
  id: string;
  label: string;
  provider: string | null;
  insurance_policy_persons: Array<{ persons: PersonRow | null }>;
};

const IDENTITY_TYPES: DocumentType[] = ["passport", "id_card"];
const ENTRY_TYPES: DocumentType[] = ["visa", "esta", "eta", "entry_permit"];

function StatusBadge({ validity }: { validity: ReturnType<typeof getDocumentValidity> }) {
  if (!validity) return null;
  return (
    <span style={{ color: DOCUMENT_VALIDITY_COLORS[validity], fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
      {DOCUMENT_VALIDITY_LABELS[validity]}
    </span>
  );
}

function DocGroup({
  title,
  docsByPerson,
  persons,
}: {
  title: string;
  docsByPerson: Map<string, DocumentRow[]>;
  persons: PersonRow[];
}) {
  const relevantPersons = persons.filter((p) => (docsByPerson.get(p.id) ?? []).length > 0);
  if (relevantPersons.length === 0) return null;

  return (
    <section className="mb-10">
      <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
        {title}
      </div>
      <div className="space-y-4">
        {relevantPersons.map((person) => (
          <div key={person.id} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.6rem" }}
              >
                {person.initials}
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{person.name}</div>
            </div>
            <div className="space-y-1.5" style={{ paddingLeft: "44px" }}>
              {(docsByPerson.get(person.id) ?? []).map((doc) => {
                const config = DOCUMENT_TYPE_CONFIG[doc.doc_type];
                const validity = getDocumentValidity(doc);
                return (
                  <Link
                    key={doc.id}
                    href={`/family/${person.id}/documents/${doc.id}`}
                    className="flex items-center justify-between gap-3"
                    style={{ textDecoration: "none" }}
                  >
                    <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
                      {config.label}: {doc.label}
                    </span>
                    <StatusBadge validity={validity} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function TravelVaultPage() {
  const supabase = await createClient();

  // §Performance-Audit: drei voneinander unabhängige Abfragen liefen bisher seriell.
  const [{ data: persons }, { data: documents }, { data: policiesRaw }] = await Promise.all([
    supabase.from("persons").select("id, name, initials").order("name"),
    supabase.from("documents").select("id, person_id, doc_type, label, expires_at, details").not("person_id", "is", null).order("created_at", { ascending: true }),
    supabase.from("insurance_policies").select("id, label, provider, insurance_policy_persons ( persons ( id, name, initials ) )").order("created_at", { ascending: true }),
  ]);
  const personList = (persons ?? []) as PersonRow[];
  const docs = (documents ?? []) as unknown as DocumentRow[];

  const identityByPerson = new Map<string, DocumentRow[]>();
  const entryByPerson = new Map<string, DocumentRow[]>();
  for (const doc of docs) {
    if (IDENTITY_TYPES.includes(doc.doc_type)) {
      const list = identityByPerson.get(doc.person_id) ?? [];
      list.push(doc);
      identityByPerson.set(doc.person_id, list);
    } else if (ENTRY_TYPES.includes(doc.doc_type)) {
      const list = entryByPerson.get(doc.person_id) ?? [];
      list.push(doc);
      entryByPerson.set(doc.person_id, list);
    }
  }

  const policies = (policiesRaw ?? []) as unknown as PolicyRow[];

  const hasAnyData = docs.length > 0 || policies.length > 0;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← Familie
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Travel Vault
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
          Alle Reisedokumente auf einen Blick
        </h1>

        {hasAnyData ? (
          <>
            <DocGroup title="Reisepässe & Ausweise" docsByPerson={identityByPerson} persons={personList} />
            <DocGroup title="Visa & Einreise" docsByPerson={entryByPerson} persons={personList} />

            {policies.length > 0 && (
              <section>
                <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                  Versicherungen
                </div>
                <div className="space-y-2">
                  {policies.map((policy) => {
                    const insuredPersons = policy.insurance_policy_persons.flatMap((p) => (p.persons ? [p.persons] : []));
                    return (
                      <Link
                        key={policy.id}
                        href={`/family/insurance/${policy.id}`}
                        className="flex items-center gap-4 p-4 rounded-xl transition-colors"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                      >
                        <div
                          className="shrink-0 flex items-center justify-center rounded-lg"
                          style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}
                        >
                          <Shield size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{policy.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{policy.provider ?? "—"}</div>
                        </div>
                        {insuredPersons.length > 0 && (
                          <div className="flex -space-x-1.5 shrink-0">
                            {insuredPersons.map((p) => (
                              <div
                                key={p.id}
                                className="w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--surface)", fontSize: "0.5rem" }}
                              >
                                {p.initials}
                              </div>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Reisedokumente oder Versicherungen hinterlegt.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
