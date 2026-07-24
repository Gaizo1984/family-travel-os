#!/usr/bin/env node
// ============================================================
// Content Studio 3.0, Remotion Lambda (eu-central-1) -- wiederholbarer
// Verifikations-Testlauf. Deployt Funktion+Site (idempotent -- legt nur an,
// falls noch nicht vorhanden), startet GENAU EINEN Testrender der
// bestehenden synthetischen 9:16/15s-Komposition (remotion/, keine echten
// Familienmedien), prueft Block Public Access des erzeugten Buckets,
// uebernimmt das Ergebnis nach privatem Supabase Storage und loescht die
// AWS-Zwischendatei danach aktiv. Gibt NIE Secret-Werte aus, nur
// abgeleitete Metriken/IDs.
//
// Aufruf: node scripts/reel-lambda-test.mjs (laedt .env.local automatisch)
// ============================================================

import path from 'node:path'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('dotenv').config({ path: '.env.local', quiet: true })
const {
  deployFunction, getOrCreateBucket, deploySiteFromBundle,
  renderMediaOnLambda, getRenderProgress, downloadMedia, deleteRender,
  getAwsClient,
} = require('@remotion/lambda')
const { createClient } = require('@supabase/supabase-js')

const REGION = 'eu-central-1'
const SITE_NAME = 'family-travel-reel'
const COMPOSITION_ID = 'ReelSpike'
const BUNDLE_DIR = path.join(process.cwd(), 'remotion', '.output')
const SUPABASE_BUCKET = 'content-reels-spike'

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

  if (!existsSync(BUNDLE_DIR)) {
    throw new Error(`Kein Bundle unter ${BUNDLE_DIR} -- vorher "npm run build" laufen lassen (prebuild-Skript erzeugt es).`)
  }

  const report = { region: REGION, errorStatus: null }
  const t0 = Date.now()

  console.log('[1/7] Lambda-Funktion deployen (idempotent) ...')
  const { functionName, alreadyExisted: functionAlreadyExisted } = await deployFunction({
    region: REGION, createCloudWatchLogGroup: true,
    memorySizeInMb: 2048, diskSizeInMb: 2048, timeoutInSeconds: 120,
  })
  report.functionName = functionName
  report.functionAlreadyExisted = functionAlreadyExisted
  console.log('  -> functionName:', functionName, '| bereits vorhanden:', functionAlreadyExisted)

  console.log('[2/7] S3-Bucket anlegen/abrufen (Folder-Expiry aktiv) ...')
  const { bucketName, alreadyExisted: bucketAlreadyExisted } = await getOrCreateBucket({
    region: REGION, enableFolderExpiry: true,
  })
  report.bucketName = bucketName
  report.bucketAlreadyExisted = bucketAlreadyExisted
  console.log('  -> bucketName:', bucketName, '| bereits vorhanden:', bucketAlreadyExisted)

  console.log('[3/7] Test-Site aus vorhandenem Bundle deployen ...')
  const siteDeployResult = await deploySiteFromBundle({
    bucketName, region: REGION, bundleDir: BUNDLE_DIR, siteName: SITE_NAME, enableFolderExpiry: true,
  })
  report.serveUrl = siteDeployResult.serveUrl
  console.log('  -> serveUrl:', siteDeployResult.serveUrl)

  console.log('[4/7] Block Public Access des Buckets pruefen ...')
  const { client: s3Client, sdk: S3 } = getAwsClient({ region: REGION, service: 's3' })
  let publicAccessBlock
  try {
    const pab = await s3Client.send(new S3.GetPublicAccessBlockCommand({ Bucket: bucketName }))
    publicAccessBlock = pab.PublicAccessBlockConfiguration
  } catch (e) {
    publicAccessBlock = { checkFailed: e.message }
  }
  report.publicAccessBlock = publicAccessBlock
  console.log('  ->', JSON.stringify(publicAccessBlock))

  console.log('[5/7] Genau einen Testrender starten (deleteAfter: 1-day) ...')
  const renderStart = Date.now()
  const renderResult = await renderMediaOnLambda({
    region: REGION, functionName, serveUrl: siteDeployResult.serveUrl,
    composition: COMPOSITION_ID, codec: 'h264', deleteAfter: '1-day',
    // §Konto-Konzurrenzlimit ist 10 (neues AWS-Konto, siehe
    // https://www.remotion.dev/docs/lambda/troubleshooting/rate-limit) --
    // fuer diesen winzigen 15s-Testrender genuegt eine einzelne
    // Lambda-Ausfuehrung vollstaendig, keine verteilte Parallelisierung noetig.
    concurrency: 1,
  })
  report.renderId = renderResult.renderId
  console.log('  -> renderId:', renderResult.renderId)

  let progress
  for (;;) {
    progress = await getRenderProgress({ renderId: renderResult.renderId, bucketName, functionName, region: REGION })
    if (progress.done || progress.fatalErrorEncountered) break
    await new Promise((r) => setTimeout(r, 3000))
  }
  const renderMs = Date.now() - renderStart
  report.renderMs = renderMs

  if (progress.fatalErrorEncountered) {
    report.errorStatus = progress.errors?.map((e) => e.message).join('; ') || 'Unbekannter Renderfehler'
    console.error('  -> Renderfehler:', report.errorStatus)
  } else {
    report.fileSizeBytes = progress.outputSizeInBytes ?? null
    report.lambdasInvoked = progress.lambdasInvoked ?? null
    report.costs = progress.costs ?? null
    console.log('  -> Render fertig in', (renderMs / 1000).toFixed(1) + 's, Groesse:', report.fileSizeBytes, 'Bytes, Kosten:', report.costs?.displayCost)

    console.log('[6/7] Ergebnis herunterladen und nach Supabase Storage uebernehmen ...')
    const outPath = path.join(process.cwd(), `.tmp-reel-lambda-test-${Date.now()}.mp4`)
    try {
      await downloadMedia({ region: REGION, bucketName, renderId: renderResult.renderId, outPath })
      const fileBuffer = readFileSync(outPath)

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const storagePath = `lambda-test/${Date.now()}.mp4`
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, fileBuffer, { contentType: 'video/mp4', cacheControl: '3600' })

      if (uploadError) {
        report.errorStatus = `Supabase-Upload fehlgeschlagen: ${uploadError.message}`
        console.error('  ->', report.errorStatus)
      } else {
        report.supabaseStoragePath = storagePath
        console.log('  -> hochgeladen nach Supabase:', storagePath)

        console.log('[7/7] AWS-Zwischendatei loeschen (nur nach erfolgreicher Uebernahme) ...')
        const del = await deleteRender({ region: REGION, bucketName, renderId: renderResult.renderId })
        report.awsCleanupFreedBytes = del.freedBytes
        report.awsCleanupDone = true
        console.log('  -> AWS-Zwischendatei geloescht, freigegeben:', del.freedBytes, 'Bytes')
      }
    } finally {
      if (existsSync(outPath)) unlinkSync(outPath)
    }
  }

  report.totalMs = Date.now() - t0
  console.log('\n=== ERGEBNIS (JSON) ===')
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error('FEHLER:', e.message)
  process.exit(1)
})
