/**
 * §Sicherheitsvorgabe: GOOGLE_PLACES_API_KEY darf nie clientseitig erscheinen.
 * Ein Places-Foto lässt sich nur mit dem Key laden -- ein `<img src>` mit der
 * Google-URL direkt würde den Key im Browser/Netzwerk-Tab offenlegen. Dieser
 * Proxy holt die Bilddaten stattdessen serverseitig und streamt nur die
 * Bytes an den Browser zurück; die URL, die der Client sieht, enthält nie
 * den Key.
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return new Response('Places-Foto nicht verfügbar', { status: 503 })

  const { path } = await params
  const photoName = path.join('/')
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) {
    return new Response('Ungültige Foto-Referenz', { status: 400 })
  }

  const maxWidthPx = new URL(request.url).searchParams.get('maxWidthPx') ?? '400'

  try {
    const googleUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${encodeURIComponent(maxWidthPx)}&key=${apiKey}`
    const res = await fetch(googleUrl, { cache: 'no-store' })
    if (!res.ok || !res.body) return new Response('Foto konnte nicht geladen werden', { status: 502 })

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return new Response('Foto konnte nicht geladen werden', { status: 502 })
  }
}
