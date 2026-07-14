-- §"Content Studio: UX-, Upload- und Content-Qualitäts-Sprint": die Content-
-- Art muss jetzt VOR dem Bild-Upload feststehen (formatabhängige Upload-
-- Limits: Beitrag/Reel max. 15, Story max. 5) statt erst bei "Content
-- erstellen" abgefragt zu werden -- additive Einzelspalte, keine neue Tabelle.
ALTER TABLE content_projects ADD COLUMN output_format TEXT;
