import type { HintContext, HintDraft, HintPriority, HintRule } from '../types'

/**
 * §"Reisepass, ESTA oder ETA läuft bald ab" (Nutzervorgabe): dünner Wrapper
 * um die bereits bestehende, zentrale Travel-Requirements-Engine
 * (lib/travel-requirements.ts, bereits im HintContext geladen) -- keine
 * eigene Ablauf-/Länder-Logik, nur eine Übersetzung ihrer Ergebnisse in
 * Hinweis-Form.
 */
export const documentExpiringRule: HintRule = {
  type: 'document_expiring',
  evaluate(ctx: HintContext): HintDraft[] {
    const drafts: HintDraft[] = []

    for (const req of ctx.travelRequirements) {
      if (req.status !== 'expiring_soon' && req.status !== 'expired') continue

      const priority: HintPriority = req.status === 'expired' ? 'critical' : 'upcoming'

      drafts.push({
        hintType: 'document_expiring',
        priority,
        title: `${req.label}${req.personName ? ` (${req.personName})` : ''}: ${req.status === 'expired' ? 'abgelaufen' : 'läuft bald ab'}`,
        reasoning: req.reason,
        relevantAt: null,
        actionLabel: req.actionLabel ?? 'Dokument ergänzen',
        actionHref: req.actionHref ?? `/family/${req.personId}`,
        bookingId: null,
        documentId: req.documentId,
        journeyEventId: null,
        dedupeKey: `document-expiring:${req.type}:${req.personId ?? 'family'}`,
        contentHashInput: `${req.status}:${req.documentId ?? ''}`,
      })
    }

    return drafts
  },
}
