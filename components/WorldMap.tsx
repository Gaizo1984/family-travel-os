import { readFileSync } from 'fs'
import path from 'path'

let cachedSvg: string | null = null

function loadBaseSvg(): string {
  if (cachedSvg) return cachedSvg
  cachedSvg = readFileSync(path.join(process.cwd(), 'public', 'world-map.svg'), 'utf8')
  return cachedSvg
}

/**
 * §"Kleine Länder per Marker/Zoom darstellen": die SVG-Pfade dieser Länder
 * sind auf der 2000×1001-Weltkarte nur ~0,3-0,4% der Kartenbreite groß und bei
 * typischer Render-Breite (~800-900px) faktisch unsichtbar/nicht antippbar.
 * Statt eines vollen Zoom/Pan-Systems bekommen diese Länder einen fest
 * positionierten, gut sichtbaren Marker-Punkt (Koordinaten aus dem SVG selbst
 * abgelesen) — nur die tatsächlich in der App als Destination vorkommenden
 * kleinen Länder, kein Anspruch auf Vollständigkeit aller Kleinstaaten.
 */
/**
 * §"San Marino, Vatikan, Palau fehlen -- als Kreis-Marker ergänzen"
 * (Nutzervorgabe): diese drei Länder haben in der Basis-SVG gar keinen
 * eigenen `<path>` (bestätigt per Grep) -- anders als die fünf Länder oben,
 * deren Pfade nur zu klein zum Antippen sind. Da hier keine SVG-Koordinaten
 * "abgelesen" werden konnten, wurden SM/VA/PW per linearer Kalibrierung aus
 * den fünf oben bereits bekannten (Land, echte Koordinate, Marker-Pixel)
 * -Paaren geschätzt (Ausgangswert: einfache Äquirektangular-Projektion auf
 * 2000×1001, per kleinster-Quadrate-Korrektur an die tatsächlichen
 * Marker-Pixel angepasst). San Marino/Vatikan liegen nahe an den bereits
 * kalibrierten Punkten Montenegro/Malta -- vermutlich zuverlässig. Palau hat
 * keinen nahen Kalibrierungspunkt (kein Pazifik-Land in der Referenzmenge)
 * -- Position ist eine gröbere Schätzung, ggf. nach echter Sichtprüfung
 * nachzujustieren.
 */
const SMALL_COUNTRY_MARKERS: Record<string, { cx: number; cy: number }> = {
  ME: { cx: 1078, cy: 300 },   // Montenegro
  MV: { cx: 1389.2, cy: 548.6 }, // Malediven
  MT: { cx: 1053, cy: 343.3 },  // Malta
  SC: { cx: 1288.3, cy: 601.8 }, // Seychellen
  MU: { cx: 1295, cy: 702.3 },  // Mauritius
  SM: { cx: 1040.4, cy: 291.6 }, // San Marino (kalibriert, nahe Montenegro/Malta)
  VA: { cx: 1041.3, cy: 304.6 }, // Vatikanstadt (kalibriert, nahe Montenegro/Malta)
  PW: { cx: 1737.9, cy: 524.9 }, // Palau (kalibriert, aber ohne nahen Referenzpunkt -- unsicherer)
}

/**
 * Reine Server-Komponente: rendert die statische Welt-SVG (Länderpfade mit
 * ISO-3166-1-alpha-2-Ids) und färbt besuchte Länder serverseitig beim Rendern
 * ein. Für besuchte, geometrisch winzige Länder wird zusätzlich ein
 * Marker-Punkt über die SVG gelegt (siehe SMALL_COUNTRY_MARKERS).
 */
export function WorldMap({ visitedCodes }: { visitedCodes: Set<string> }) {
  const base = loadBaseSvg()

  const highlightRules = Array.from(visitedCodes)
    .map((code) => `#${code}{fill:var(--accent);fill-opacity:0.85;}`)
    .join('')

  const style = `<style>
    path{fill:var(--border);stroke:var(--background);stroke-width:1.2;}
    ${highlightRules}
  </style>`

  const markers = Array.from(visitedCodes)
    .filter((code) => SMALL_COUNTRY_MARKERS[code])
    .map((code) => {
      const { cx, cy } = SMALL_COUNTRY_MARKERS[code]
      return `<circle cx="${cx}" cy="${cy}" r="6" fill="var(--accent)" stroke="var(--background)" stroke-width="1.2"><title>${code}</title></circle>`
    })
    .join('')

  const html = base
    .replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')
    .replace('</svg>', `${style}${markers}</svg>`)

  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
