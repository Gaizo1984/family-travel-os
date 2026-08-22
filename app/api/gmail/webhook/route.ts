import { NextRequest, NextResponse } from 'next/server'
import { verifyPubSubPushRequest } from '@/lib/gmail/pubsub-auth'

/**
 * §Reise-Postfach, Implementierungsschritt "Webhook-Grundgerüst"
 * (Nutzervorgabe, wörtlich): "Noch keine Mailinhalte verarbeiten; zunächst
 * nur validierte Pub/Sub-Push-Nachrichten sicher annehmen und mit 2xx
 * quittieren." Diese Route tut ausschließlich das -- kein Gmail-API-Aufruf,
 * keine Extraktion, keine Buchungs-/Dokumentlogik. Das folgt erst in einem
 * späteren Schritt, sobald die bestehende Pull-Subscription gemeinsam auf
 * Push + OIDC umgestellt ist.
 *
 * §Sicherheit: von proxy.ts explizit von der normalen Login-Pflicht
 * ausgenommen (s. dortiger Kommentar `isGmailWebhookPath`, analog zu
 * `isCronPath`) -- Pub/Sub ruft ohne Browser-Session auf. Sichert sich
 * stattdessen vollständig selbst über die OIDC-Token-Prüfung
 * (lib/gmail/pubsub-auth.ts): Signatur, Audience, erwartete
 * Service-Account-Identität. Der optionale zweite Faktor
 * (GMAIL_WEBHOOK_SHARED_SECRET als Query-Parameter) ist bewusst NICHT die
 * primäre Absicherung, sondern Defense-in-Depth -- fehlt er, wird nur die
 * OIDC-Prüfung verlangt, niemals umgekehrt.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

function isSharedSecretValid(request: NextRequest): boolean {
  const configured = process.env.GMAIL_WEBHOOK_SHARED_SECRET
  if (!configured) return true
  return request.nextUrl.searchParams.get('token') === configured
}

type PubSubPushEnvelope = {
  message?: { data?: string; messageId?: string; publishTime?: string; attributes?: Record<string, string> }
  subscription?: string
}

export async function POST(request: NextRequest) {
  if (!isSharedSecretValid(request)) {
    console.error('[gmail-webhook] ungültiges/fehlendes Shared-Secret')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const auth = await verifyPubSubPushRequest(request.headers.get('authorization'))
  if (!auth.ok) {
    // Nie das Token selbst loggen -- s. lib/gmail/pubsub-auth.ts.
    console.error('[gmail-webhook] OIDC-Prüfung fehlgeschlagen:', auth.reason)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let envelope: PubSubPushEnvelope | null = null
  try {
    envelope = (await request.json()) as PubSubPushEnvelope
  } catch {
    // Kaputtes/fehlendes JSON nach erfolgreicher Auth ist unser Problem, kein
    // Grund für Pub/Sub, endlos erneut zuzustellen -- trotzdem quittieren.
    console.error('[gmail-webhook] Push-Envelope nicht als JSON lesbar')
    return NextResponse.json({ ok: true, accepted: false })
  }

  // §Vorgabe (dieser Schritt): nur annehmen und quittieren. NIE
  // envelope.message.data (Base64 der eigentlichen Gmail-Benachrichtigung)
  // loggen oder auswerten -- nur unkritische Zustellungs-Metadaten.
  console.log('[gmail-webhook] validierte Push-Nachricht angenommen', {
    subscription: envelope.subscription ?? null,
    messageId: envelope.message?.messageId ?? null,
    publishTime: envelope.message?.publishTime ?? null,
  })

  return NextResponse.json({ ok: true, accepted: true })
}
