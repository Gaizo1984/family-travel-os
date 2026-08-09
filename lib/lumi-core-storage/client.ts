import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

/**
 * Dünne Wrapper um die Lumi-Core-Storage-API, gleiche Optionsform wie die
 * bestehenden Travel-Call-Sites (siehe lib/actions/documents.ts u.a.):
 * `contentType`, `cacheControl`, optional `upsert` (Standard: false --
 * kein Overwrite, wie beim Bulk-Copy). Nutzt den bestehenden
 * cookie-basierten `createLumiCoreClient()` -- KEINE Service Role.
 */

export type UploadFile = Blob | File | Buffer | ArrayBuffer

export async function uploadToLumiCore(
  bucket: string,
  path: string,
  file: UploadFile,
  options: { contentType?: string; cacheControl?: string; upsert?: boolean } = {},
): Promise<{ error: string | null }> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.storage.from(bucket).upload(path, file, {
    contentType: options.contentType,
    cacheControl: options.cacheControl ?? '31536000',
    upsert: options.upsert ?? false,
  })
  return { error: error?.message ?? null }
}

export async function downloadFromLumiCore(bucket: string, path: string): Promise<{ data: Blob | null; error: string | null }> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.storage.from(bucket).download(path)
  return { data: data ?? null, error: error?.message ?? null }
}

export async function removeFromLumiCore(bucket: string, paths: string[]): Promise<{ error: string | null }> {
  if (paths.length === 0) return { error: null }
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.storage.from(bucket).remove(paths)
  return { error: error?.message ?? null }
}

export async function listLumiCore(
  bucket: string,
  dir: string,
  options?: { search?: string; limit?: number },
): Promise<{ names: string[]; error: string | null }> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.storage.from(bucket).list(dir, options)
  return { names: (data ?? []).map((f) => f.name), error: error?.message ?? null }
}
