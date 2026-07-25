#!/usr/bin/env node
// ============================================================
// Content Studio 3.0, Sprint 5 -- End-to-End-Smoke-Test des ECHTEN
// Reel-Renderings (dynamische Szenendauer, Stil-Komposition, Vorschau-
// Qualitätsstufe) über die bestehende Remotion-Lambda-Infrastruktur (siehe
// scripts/reel-lambda-test.mjs, Etappe 2). Nutzt ausschließlich die bereits
// im Repo vorhandenen synthetischen Testbilder (remotion/public/test-photo-
// {1,2}.jpg, KEINE echten Familienfotos), rendert GENAU EINEN Vorschau-
// Render (deleteAfter: "1-day", scale 0.5) über die "FamilyMemoryReel"-
// Komposition mit zwei Szenen, deren Dauer sich zu exakt 15s summiert --
// prüft damit direkt, ob `calculateMetadata` (remotion/Root.tsx) die reale
// Szenendauer korrekt übernimmt. Ausgabe landet testweise im PRODUKTIVEN
// "content-reels"-Bucket unter smoke-test/..., wird danach entfernt. Gibt
// NIE Secret-Werte aus, nur abgeleitete Metriken/IDs.
//
// Aufruf: node scripts/reel-render-e2e-test.mjs (laedt .env.local automatisch)
// ============================================================

import path from 'node:path'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('dotenv').config({ path: '.env.local', quiet: true })
const {
  deployFunction, getOrCreateBucket, deploySiteFromBundle,
  renderMediaOnLambda, getRenderProgress, downloadMedia, deleteRender,
} = require('@remotion/lambda')
const { createClient } = require('@supabase/supabase-js')

const REGION = 'eu-central-1'
const SITE_NAME = 'family-travel-reel'
const COMPOSITION_ID = 'FamilyMemoryReel'
const BUNDLE_DIR = path.join(process.cwd(), 'remotion', '.output')
const SOURCE_BUCKET = 'documents'
const OUTPUT_BUCKET = 'content-reels'
const TARGET_DURATION_SECONDS = 15

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Fehlende Environment-Variable: ${name}`)
  return v
}

async function main() {
  requireEnv('REMOTION_AWS_ACCESS_KEY_ID')
  requireEnv('REMOTION_AWS_SECRET_ACCESS_KEY')
  const region = requireEnv('REMOTION_AWS_REGION')
  if (region !== REGION) throw new Error(`REMOTION_AWS_REGION muss "${REGION}" sein.`)
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  requireEnv('NEXT_PUBLIC_SUPABASE_URL')

  if (!existsSync(BUNDLE_DIR)) throw new Error(`Kein Bundle unter ${BUNDLE_DIR} -- vorher "npm run build" laufen lassen.`)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const report = { region: REGION, composition: COMPOSITION_ID, errorStatus: null }
  const t0 = Date.now()
  const testId = Date.now()

  // ── [1] Synthetische Testbilder hochladen (kein echtes Familienmedium) ──
  console.log('[1/8] Synthetische Testbilder hochladen ...')
  const photo1 = readFileSync(path.join(process.cwd(), 'remotion', 'public', 'test-photo-1.jpg'))
  const photo2 = readFileSync(path.join(process.cwd(), 'remotion', 'public', 'test-photo-2.jpg'))
  const path1 = `smoke-test/reel-render-e2e/${testId}-1.jpg`
  const path2 = `smoke-test/reel-render-e2e/${testId}-2.jpg`
  await supabase.storage.from(SOURCE_BUCKET).upload(path1, photo1, { contentType: 'image/jpeg' })
  await supabase.storage.from(SOURCE_BUCKET).upload(path2, photo2, { contentType: 'image/jpeg' })
  const { data: signed1 } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(path1, 3600)
  const { data: signed2 } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(path2, 3600)
  if (!signed1?.signedUrl || !signed2?.signedUrl) throw new Error('Testbilder konnten nicht signiert werden.')
  console.log('  -> hochgeladen und signiert.')

  // ── [2] Szenen mit dynamischer Dauer (Summe = TARGET_DURATION_SECONDS) ──
  const scenes = [
    { sourceType: 'photo', mediaUrl: signed1.signedUrl, durationSeconds: 7, transition: 'fade', cameraMotion: 'ken_burns_in', textOverlay: 'E2E-Test Szene 1', videoStartSeconds: null },
    { sourceType: 'photo', mediaUrl: signed2.signedUrl, durationSeconds: 8, transition: 'cut', cameraMotion: 'pan_left', textOverlay: 'E2E-Test Szene 2', videoStartSeconds: null },
  ]
  report.expectedDurationSeconds = scenes.reduce((s, sc) => s + sc.durationSeconds, 0)
  if (report.expectedDurationSeconds !== TARGET_DURATION_SECONDS) throw new Error('Szenen-Testdaten falsch konfiguriert.')

  console.log('[2/8] Lambda-Funktion deployen (idempotent) ...')
  const { functionName } = await deployFunction({ region: REGION, createCloudWatchLogGroup: true, memorySizeInMb: 2048, diskSizeInMb: 2048, timeoutInSeconds: 120 })
  report.functionName = functionName

  console.log('[3/8] S3-Bucket abrufen/anlegen ...')
  const { bucketName } = await getOrCreateBucket({ region: REGION, enableFolderExpiry: true })
  report.bucketName = bucketName

  console.log('[4/8] Site MIT AKTUELLEM Bundle neu deployen (enthält jetzt die 3 Stil-Kompositionen aus Sprint 4) ...')
  const siteDeployResult = await deploySiteFromBundle({ bucketName, region: REGION, bundleDir: BUNDLE_DIR, siteName: SITE_NAME })
  report.serveUrl = siteDeployResult.serveUrl
  console.log('  -> serveUrl:', siteDeployResult.serveUrl)

  console.log('[5/8] Genau einen Vorschau-Testrender starten (dynamische Dauer, deleteAfter: 1-day) ...')
  const renderStart = Date.now()
  const renderResult = await renderMediaOnLambda({
    region: REGION, functionName, serveUrl: siteDeployResult.serveUrl,
    composition: COMPOSITION_ID, codec: 'h264', deleteAfter: '1-day', concurrency: 1,
    inputProps: { scenes, style: 'family_memory', musicUrl: null },
    scale: 0.5, jpegQuality: 60,
  })
  report.renderId = renderResult.renderId
  console.log('  -> renderId:', renderResult.renderId)

  let progress
  for (;;) {
    progress = await getRenderProgress({ renderId: renderResult.renderId, bucketName, functionName, region: REGION })
    if (progress.done || progress.fatalErrorEncountered) break
    await new Promise((r) => setTimeout(r, 3000))
  }
  report.renderMs = Date.now() - renderStart

  if (progress.fatalErrorEncountered) {
    report.errorStatus = progress.errors?.map((e) => e.message).join('; ') || 'Unbekannter Renderfehler'
    console.error('  -> Renderfehler:', report.errorStatus)
  } else {
    report.fileSizeBytes = progress.outputSizeInBytes ?? null
    report.costs = progress.costs ?? null
    console.log('  -> Render fertig in', (report.renderMs / 1000).toFixed(1) + 's, Größe:', report.fileSizeBytes, 'Bytes, Kosten:', report.costs?.displayCost)

    console.log('[6/8] Ergebnis herunterladen und nach content-reels (Testpfad) übernehmen ...')
    const outPath = path.join(process.cwd(), `.tmp-reel-render-e2e-${testId}.mp4`)
    try {
      await downloadMedia({ region: REGION, bucketName, renderId: renderResult.renderId, outPath })
      const fileBuffer = readFileSync(outPath)
      report.downloadedSizeBytes = fileBuffer.length

      const outputPath = `smoke-test/${testId}.mp4`
      const { error: uploadError } = await supabase.storage.from(OUTPUT_BUCKET).upload(outputPath, fileBuffer, { contentType: 'video/mp4' })
      if (uploadError) {
        report.errorStatus = `Supabase-Upload fehlgeschlagen: ${uploadError.message}`
        console.error('  ->', report.errorStatus)
      } else {
        console.log('  -> hochgeladen nach content-reels:', outputPath)

        console.log('[7/8] AWS-Zwischendatei löschen (nur nach erfolgreicher Übernahme) ...')
        const del = await deleteRender({ region: REGION, bucketName, renderId: renderResult.renderId })
        report.awsCleanupFreedBytes = del.freedBytes
        console.log('  -> gelöscht, freigegeben:', del.freedBytes, 'Bytes')

        console.log('[8/8] Supabase-Testartefakte aufräumen ...')
        await supabase.storage.from(OUTPUT_BUCKET).remove([outputPath])
        report.supabaseCleanupDone = true
        console.log('  -> content-reels-Testdatei entfernt.')
      }
    } finally {
      if (existsSync(outPath)) unlinkSync(outPath)
    }
  }

  await supabase.storage.from(SOURCE_BUCKET).remove([path1, path2])
  report.sourceCleanupDone = true

  report.totalMs = Date.now() - t0
  console.log('\n=== ERGEBNIS (JSON) ===')
  console.log(JSON.stringify(report, null, 2))
  if (report.errorStatus) process.exitCode = 1
}

main().catch((e) => {
  console.error('FEHLER:', e.message)
  process.exitCode = 1
})
