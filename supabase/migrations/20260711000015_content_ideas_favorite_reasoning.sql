-- Phase 10: Content Studio – Ideen favorisierbar machen und die KI-Begründung
-- ("warum genau diese Ideen?") mitpersistieren. Rein additiv.
-- Archivieren nutzt den bereits vorhandenen status-Wert 'archived', keine
-- weitere Spalte nötig.

ALTER TABLE content_ideas ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE content_ideas ADD COLUMN reasoning TEXT;
