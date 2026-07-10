import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updatePersonProfile } from "@/lib/actions/persons";
import { TRAVEL_NEED_OPTIONS } from "@/lib/family-dna";
import { PhotoCropInput } from "@/components/PhotoCropInput";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function EditPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  const { personId } = await params;
  const { error, return_to } = await searchParams;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name, role_label, description, interest_tags, travel_needs, photo_storage_path")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  let photoUrl: string | null = null;
  if (person.photo_storage_path) {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(person.photo_storage_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

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
          Profil bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {person.name}
        </h1>

        <form action={updatePersonProfile} encType="multipart/form-data">
          <input type="hidden" name="person_id" value={person.id} />
          {return_to && <input type="hidden" name="return_to" value={return_to} />}

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
            )}

            <PhotoCropInput name="file" label="Foto" existingPhotoUrl={photoUrl} />

            <div className="mb-5">
              <label htmlFor="p-name" style={LABEL_STYLE}>Name *</label>
              <input id="p-name" name="name" type="text" required defaultValue={person.name} style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="p-role" style={LABEL_STYLE}>Rolle / Reisetyp</label>
              <input id="p-role" name="role_label" type="text" defaultValue={person.role_label ?? ""} placeholder="z. B. Abenteurerin, Genießer" style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="p-description" style={LABEL_STYLE}>Kurzbeschreibung</label>
              <textarea id="p-description" name="description" rows={3} defaultValue={person.description ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="mb-5">
              <label htmlFor="p-tags" style={LABEL_STYLE}>Interessen-Tags (kommagetrennt)</label>
              <input
                id="p-tags" name="interest_tags" type="text"
                defaultValue={person.interest_tags.join(", ")}
                placeholder="z. B. Tiere, Schnorcheln, Fotografie"
                style={FIELD_STYLE}
              />
            </div>

            <div className="mb-8">
              <div style={LABEL_STYLE}>Individuelle Reisebedürfnisse</div>
              <div className="flex flex-wrap gap-3">
                {TRAVEL_NEED_OPTIONS.map((need) => (
                  <label key={need.key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox" name={`need_${need.key}`}
                      defaultChecked={person.travel_needs.includes(need.key)}
                      style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>{need.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href={cancelHref} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none",
                  borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                  letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                  whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Profil speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
