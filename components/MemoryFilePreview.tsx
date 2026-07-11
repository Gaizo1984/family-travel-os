'use client'

import { useState } from 'react'

/**
 * §"Einzelbilder sofort anzeigen": zeigt ausgewählte Dateien direkt nach der
 * Auswahl als Thumbnails an (vor dem Absenden) — ohne Server-Architektur-
 * Umbau, rein clientseitig via `URL.createObjectURL`.
 */
export function MemoryFilePreview({
  inputId,
  inputName,
  fieldStyle,
}: {
  inputId: string
  inputName: string
  fieldStyle: React.CSSProperties
}) {
  const [previews, setPreviews] = useState<string[]>([]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const files = Array.from(e.target.files ?? []);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  return (
    <div>
      <input
        id={inputId} name={inputName} type="file" multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        style={{ ...fieldStyle, padding: "10px 16px" }}
      />
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {previews.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="rounded-lg object-cover" style={{ width: 64, height: 64 }} />
          ))}
        </div>
      )}
    </div>
  );
}
