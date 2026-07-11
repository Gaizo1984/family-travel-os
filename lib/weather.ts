import type { LucideIcon } from 'lucide-react'
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react'

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
  daily: DailyForecast[] // 5 Tage, Index 0 = heute (im Zeitfenster des Zielorts, siehe todayForecast-Auswahl im Aufrufer)
  /** Erste Stunde ab heute 00:00 (Zielort-lokal, "HH:00"), ab der Regen mit ≥50 % Wahrscheinlichkeit einsetzt — null, wenn kein klarer Einsatzpunkt erkennbar ist. */
  rainStartsAt: string | null
}

type GeoResult = { lat: number; lon: number; name: string }
type ForecastResult = Omit<WeatherResult, 'locationName'>

/**
 * Provider-Abstraktion: der Rest der App kennt nur `getWeatherForLocation`/
 * `WeatherResult` — welcher Anbieter dahinter tatsächlich Koordinaten und
 * Vorhersagen liefert, ist über dieses Interface gekapselt. Ein Wechsel zu
 * WeatherAPI/Tomorrow.io (z. B. bei Bedarf für stündliche Präzision oder
 * einen anderen Kostenrahmen) bedeutet später nur eine neue Implementierung
 * dieses Interfaces plus einen einzigen Zuweisungspunkt (`activeProvider`),
 * keinen Umbau der aufrufenden Seiten.
 */
interface WeatherProvider {
  geocode(query: string, countryCode?: string | null): Promise<GeoResult | null>
  forecast(lat: number, lon: number): Promise<ForecastResult | null>
}

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/**
 * Wichtiger Fund beim Debuggen unplausibler Temperaturen: Open-Meteos
 * Geocoding-Endpunkt besitzt KEINEN funktionierenden Land-Filter-Parameter
 * (weder `countryCode` noch `country_code` schränken die Trefferliste
 * tatsächlich ein — beide wurden live gegen die API verifiziert). Die
 * vorige Implementierung übergab `countryCode` und erhielt dadurch bei
 * jeder Anfrage mit diesem Parameter STETS ein leeres Ergebnis zurück,
 * wodurch die Etappen-/Hotel-Geokodierung faktisch nie griff und praktisch
 * immer auf die grobe Landes-Koordinate zurückgefallen wurde — bei Costa
 * Rica ein Punkt im gebirgigen Landesinneren (~1400 m, San-José-Region)
 * statt der tatsächlichen Küstenregion, daher die zu kühlen/unplausiblen
 * Werte. Fix: mehrere Treffer abfragen und das erwartete Land selbst im
 * Code aus den zurückgegebenen `country_code`-Feldern auswählen.
 */
async function openMeteoGeocode(query: string, countryCode?: string | null): Promise<GeoResult | null> {
  try {
    const params = new URLSearchParams({ name: query, count: '8', language: 'de', format: 'json' })
    const res = await fetch(`${GEOCODING_URL}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const results: Array<{ latitude: number; longitude: number; name: string; country_code?: string }> = data?.results ?? []
    if (results.length === 0) return null

    const match = countryCode
      ? results.find((r) => r.country_code === countryCode) ?? null
      : results[0]
    if (!match) return null

    return { lat: match.latitude, lon: match.longitude, name: match.name }
  } catch {
    return null
  }
}

async function openMeteoForecast(lat: number, lon: number): Promise<ForecastResult | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,weather_code',
      hourly: 'precipitation_probability',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max',
      timezone: 'auto',
      temperature_unit: 'celsius',
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

    // Erste Stunde des Zielort-"heute" (erste 24 Einträge von hourly.time), ab der
    // die stündliche Regenwahrscheinlichkeit ≥50 % erreicht — für eine zeitbezogene
    // Formulierung ("Regen ab 16:00 Uhr") statt einer reinen Tagesprozentzahl.
    let rainStartsAt: string | null = null
    const hourlyTimes: string[] = data.hourly?.time ?? []
    const hourlyProb: number[] = data.hourly?.precipitation_probability ?? []
    const todayDate = data.daily?.time?.[0]
    for (let i = 0; i < hourlyTimes.length; i++) {
      if (todayDate && !hourlyTimes[i].startsWith(todayDate)) continue
      if ((hourlyProb[i] ?? 0) >= 50) {
        rainStartsAt = hourlyTimes[i].slice(11, 16)
        break
      }
    }

    return {
      currentTemp: Math.round(data.current?.temperature_2m ?? daily[0]?.tempMax ?? 0),
      currentCode: data.current?.weather_code ?? daily[0]?.code ?? 0,
      sunrise: data.daily?.sunrise?.[0] ?? null,
      sunset: data.daily?.sunset?.[0] ?? null,
      daily,
      rainStartsAt,
    }
  } catch {
    return null
  }
}

const openMeteoProvider: WeatherProvider = { geocode: openMeteoGeocode, forecast: openMeteoForecast }

/** Einziger Zuweisungspunkt für den aktiven Wetteranbieter — siehe WeatherProvider-Kommentar oben. */
const activeProvider: WeatherProvider = openMeteoProvider

export type WeatherLocationCandidate = { query: string; countryCode?: string | null }

/**
 * Fallback-Kette Hotel → Etappe → Reiseziel: probiert die übergebenen
 * Kandidaten der Reihe nach (üblicherweise Unterkunftsname, Etappenort,
 * andere Etappen derselben Reise, Landesname als letzte Instanz) und nimmt
 * den ersten, der sich geokodieren lässt. Gibt bei komplettem Fehlschlag
 * `null` zurück, statt die Seite mit einer fehlenden Wetter-Sektion
 * abstürzen zu lassen.
 */
export async function getWeatherForLocation(candidates: WeatherLocationCandidate[]): Promise<WeatherResult | null> {
  for (const candidate of candidates) {
    if (!candidate.query) continue
    const geo = await activeProvider.geocode(candidate.query, candidate.countryCode ?? undefined)
    if (!geo) continue
    const forecast = await activeProvider.forecast(geo.lat, geo.lon)
    if (!forecast) continue
    return { locationName: geo.name, ...forecast }
  }
  return null
}
