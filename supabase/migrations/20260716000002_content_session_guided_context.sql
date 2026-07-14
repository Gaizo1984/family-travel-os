-- §"Geführter Content-Kontext" + "Passungsprüfung": Fokus/Stimmung/Hinweis
-- werden bei jedem "Content erstellen"-Klick auf der Session gespeichert
-- (nicht nur clientseitig gehalten), damit die Passungsprüfungs-
-- Abhilfe-Buttons ("Mit vorhandenem Material erstellen"/"Engeren Fokus
-- wählen") nach einem Redirect ohne erneute Eingabe erneut auslösen können --
-- additive Spalten auf der bestehenden content_projects-Zeile, keine neue Tabelle.
ALTER TABLE content_projects
  ADD COLUMN content_focus TEXT,
  ADD COLUMN custom_focus TEXT,
  ADD COLUMN mood TEXT[],
  ADD COLUMN hint_text TEXT;
