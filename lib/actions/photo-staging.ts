'use server'

import { createClient } from '@/lib/supabase/server'

export type UploadSlot = { path: string; token: string }

/**
 * §Root-Cause-Fix "This page couldn't load" bei Mehrfach-Foto-Upload: Vercel
 * begrenzt den Request-Body von Serverless Functions PLATTFORMSEITIG auf
 * 4,5 MB — unabhängig von Next.js' eigenem serverActions.bodySizeLimit
 * (das nur das Framework-Limit erhöht, nicht Vercels eigenes, davor
 * liegendes Routing-Limit). Ein einzelnes Handyfoto lag meist knapp
 * darunter, zwei oder mehr Fotos im selben multipart-Formular-Body
 * überschritten es zuverlässig — daher "geht mit 1 Foto, nie mit 2+".
 * Fix (offizielle Vercel-Empfehlung): Fotos werden direkt vom Browser zu
 * Supabase Storage hochgeladen (Signed Upload URL), NICHT mehr über den
 * Server-Action-Request-Body. Gemeinsam genutzt von Travel Memory,
 * Content-Ideen und Bilder-analysieren (identisches Muster, keine
 * Duplizierung der Storage-Logik — vgl. gemeinsame Foto-Analyse-Pipeline).
 */
export async function createUploadSlots(familyId: string, count: number): Promise<UploadSlot[]> {
  if (count <= 0 || count > 20) throw new Error('Ungültige Foto-Anzahl')
  const supabase = await createClient()
  return Promise.all(
    Array.from({ length: count }, async () => {
      const path = `uploads-staging/${familyId}/${crypto.randomUUID()}`
      const { data, error } = await supabase.storage.from('documents').createSignedUploadUrl(path)
      if (error || !data) throw new Error(error?.message ?? 'Signed-Upload-URL konnte nicht erzeugt werden')
      return { path, token: data.token }
    }),
  )
}

/**
 * Lädt eine zuvor per Signed-Upload-URL direkt vom Browser hochgeladene
 * Datei serverseitig herunter (für Kompression/KI-Analyse/Umkopieren an den
 * endgültigen Speicherpfad) und entfernt sie danach aus dem Staging-Bereich.
 * Dieser Download-Roundtrip läuft Function-zu-Storage, nicht Client-zu-
 * Function — unterliegt daher NICHT dem Vercel-Body-Limit.
 */
export async function downloadAndClearStagedUpload(
  stagingPath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('documents').download(stagingPath)
  if (error || !data) return null
  const buffer = Buffer.from(await data.arrayBuffer())
  await supabase.storage.from('documents').remove([stagingPath])
  return { buffer, mimeType: data.type || 'application/octet-stream' }
}
