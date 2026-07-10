import { readFileSync } from 'fs'
import path from 'path'

let cachedSvg: string | null = null

function loadBaseSvg(): string {
  if (cachedSvg) return cachedSvg
  cachedSvg = readFileSync(path.join(process.cwd(), 'public', 'world-map.svg'), 'utf8')
  return cachedSvg
}

/**
 * Reine Server-Komponente: rendert die statische Welt-SVG (Länderpfade mit
 * ISO-3166-1-alpha-2-Ids) und färbt besuchte Länder serverseitig beim Rendern
 * ein. Keine Interaktivität nötig — passt zur Zero-Client-JS-Philosophie.
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

  const html = base
    .replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')
    .replace('</svg>', `${style}</svg>`)

  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
