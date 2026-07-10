import type { LucideIcon } from 'lucide-react'
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react'

/**
 * Open-Meteo: kostenlos, ohne API-Key, kein neuer kostenpflichtiger Dienst.
 * Geocoding (Ortsname → Koordinaten) und Forecast sind zwei getrennte,
 * ebenfalls kostenlose Endpunkte desselben Anbieters.
 */
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

type WmoInfo = { label: string; icon: LucideIcon }

/** WMO-Wettercode-Tabelle (Open-Meteo-Standard) → deutsches Label + Icon. */
const WMO_CODES: Record<number, WmoInfo> = {
  0: { label: 'Klarer Himmel', icon: Sun },
  1: { label: 'Überwiegend klar', icon: Sun },
  2: { label: 'Teilweise bewölkt', icon: CloudSun },
  3: { label: 'Bedeckt', icon: Cloud },
  45: { label: 'Nebel', icon: CloudFog },
  48: { label: 'Reifnebel', icon: CloudFog },
  51: { label: 'Leichter Nieselregen', icon: CloudDrizzle },
  53: { label: 'Nieselregen', icon: CloudDrizzle },
  55: { label: 'Starker Nieselregen', icon: CloudDrizzle },
  56: { label: 'Gefrierender Nieselregen', icon: CloudDrizzle },
  57: { label: 'Starker gefrierender Nieselregen', icon: CloudDrizzle },
  61: { label: 'Leichter Regen', icon: CloudRain },
  63: { label: 'Regen', icon: CloudRain },
  65: { label: 'Starker Regen', icon: CloudRain },
  66: { label: 'Gefrierender Regen', icon: CloudRain },
  67: { label: 'Starker gefrierender Regen', icon: CloudRain },
  71: { label: 'Leichter Schneefall', icon: CloudSnow },
  73: { label: 'Schneefall', icon: CloudSnow },
  75: { label: 'Starker Schneefall', icon: CloudSnow },
  77: { label: 'Schneegriesel', icon: CloudSnow },
  80: { label: 'Leichte Regenschauer', icon: CloudRain },
  81: { label: 'Regenschauer', icon: CloudRain },
  82: { label: 'Heftige Regenschauer', icon: CloudRain },
  85: { label: 'Leichte Schneeschauer', icon: CloudSnow },
  86: { label: 'Starke Schneeschauer', icon: CloudSnow },
  95: { label: 'Gewitter', icon: CloudLightning },
  96: { label: 'Gewitter mit Hagel', icon: CloudLightning },
  99: { label: 'Schweres Gewitter mit Hagel', icon: CloudLightning },
}

export function describeWeatherCode(code: number): WmoInfo {
  return WMO_CODES[code] ?? { label: 'Unbekannt', icon: Cloud }
}

export type DailyForecast = {
  date: string
  tempMax: number
  tempMin: number
  code: number
  precipitationProbability: number | null
}

export type WeatherResult = {
  locationName: string
  currentTemp: number
  currentCode: number
  sunrise: string | null
  sunset: string | null
  daily: DailyForecast[] // 5 Tage, Index 0 = heute
}

/**
 * Ortsnamen wie einzelne Etappen-/Hotelbezeichnungen sind im Geocoding-Datensatz
 * oft mehrdeutig (z. B. gibt es "Guanacaste" auch als Kleinstort in Mexiko,
 * Honduras und El Salvador, aber nicht in Costa Rica erfasst) — mit `countryCode`
 * wird auf Treffer im bekannten Zielland eingeschränkt, um falsche Länder zu
 * vermeiden. Liefert bei einer zu engen Einschränkung bewusst `null` zurück,
 * statt einen falschen Treffer in einem anderen Land zu akzeptieren.
 */
async function geocodeLocation(query: string, countryCode?: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const params = new URLSearchParams({ name: query, count: '1', language: 'de', format: 'json' })
    if (countryCode) params.set('countryCode', countryCode)
    const res = await fetch(`${GEOCODING_URL}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const first = data?.results?.[0]
    if (!first) return null
    return { lat: first.latitude, lon: first.longitude, name: first.name }
  } catch {
    return null
  }
}

async function fetchForecast(lat: number, lon: number): Promise<Omit<WeatherResult, 'locationName'> | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '5',
    })
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()

    const daily: DailyForecast[] = (data.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
      code: data.daily.weather_code[i],
      precipitationProbability: data.daily.precipitation_probability_max?.[i] ?? null,
    }))

    return {
      currentTemp: Math.round(data.current?.temperature_2m ?? daily[0]?.tempMax ?? 0),
      currentCode: data.current?.weather_code ?? daily[0]?.code ?? 0,
      sunrise: data.daily?.sunrise?.[0] ?? null,
      sunset: data.daily?.sunset?.[0] ?? null,
      daily,
    }
  } catch {
    return null
  }
}

export type WeatherLocationCandidate = { query: string; countryCode?: string | null }

/**
 * Fallback-Kette Hotel → Etappe → Reiseziel: probiert die übergebenen
 * Kandidaten der Reihe nach (üblicherweise Unterkunftsname, Etappenort,
 * Landesname/Reisetitel als letzte Instanz) und nimmt den ersten, der sich
 * geokodieren lässt. `countryCode` schränkt pro Kandidat auf das erwartete
 * Land ein, um Falschtreffer in einem anderen Land zu vermeiden (siehe
 * geocodeLocation). Gibt bei komplettem Fehlschlag `null` zurück, statt die
 * Seite mit einer fehlenden Wetter-Sektion abstürzen zu lassen.
 */
export async function getWeatherForLocation(candidates: WeatherLocationCandidate[]): Promise<WeatherResult | null> {
  for (const candidate of candidates) {
    if (!candidate.query) continue
    const geo = await geocodeLocation(candidate.query, candidate.countryCode ?? undefined)
    if (!geo) continue
    const forecast = await fetchForecast(geo.lat, geo.lon)
    if (!forecast) continue
    return { locationName: geo.name, ...forecast }
  }
  return null
}
