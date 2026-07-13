/**
 * §"Regeln konfigurierbar halten, nicht im UI verdrahten": Tagestrip-Radius
 * je Strecke (≈ 2,5 Std.), geteilt zwischen Tagestrip- und
 * OpenAI-Empfehlungsmodul (beide dürfen Kandidaten außerhalb dieses
 * Radius nie als normalen Ausflug behandeln). Eigene Datei, da
 * `'use server'`-Dateien ausschließlich async Funktionen exportieren
 * dürfen (keine Konstanten).
 */
export const MAX_LEG_MINUTES = 150
