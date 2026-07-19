-- §"Seed-Reisen komplett aus der Produktions-DB entfernen" (Nutzervorgabe,
-- kombinierter Fix-Sprint Offline-Reisen/Merklisten): die vier Demo-Reisen aus
-- 20260708000004_seed_trips.sql sind echte Zeilen in der Live-`trips`-Tabelle,
-- ohne jedes Unterscheidungsmerkmal zu echten Nutzer-Reisen (kein is_demo-Flag).
-- Abhängige Zeilen (stages, bookings, documents, trip_members, journey_events,
-- trip_budget_items, category_places_cache, day_plan_cache,
-- concierge_category_suggestions, today_recommendations, content_strategies,
-- concierge_messages, document_trips, insurance_policy_trips) hängen an
-- ON DELETE CASCADE und werden automatisch mitentfernt. Tabellen mit
-- ON DELETE SET NULL (family_memories, memory_photos, photo_analysis,
-- content_ideas) verlieren nur den Reisebezug, bleiben aber bestehen.
DELETE FROM trips WHERE id IN (
  '20000000-0000-0000-0000-000000000001', -- costa-rica-2026
  '20000000-0000-0000-0000-000000000002', -- indonesien-2028
  '20000000-0000-0000-0000-000000000003', -- japan-2025
  '20000000-0000-0000-0000-000000000004'  -- sardinien-2024
);
