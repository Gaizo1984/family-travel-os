-- Seed: 4 Familienreisen aus der bisherigen Demo-Data
-- Familie Gaitantzis — UUID: 00000000-0000-0000-0000-000000000001
-- Persons: MA=...0001, SA=...0002, LI=...0003, EL=...0004, LU=...0005

-- ─── Reisen ────────────────────────────────────────────────────────────────────

INSERT INTO trips (id, slug, family_id, title, subtitle, status, start_date, end_date, cover_emoji, gradient_from, gradient_via, gradient_to) VALUES
  ('20000000-0000-0000-0000-000000000001', 'costa-rica-2026', '00000000-0000-0000-0000-000000000001',
   'Costa Rica 2026', 'Guanacaste · La Fortuna · Osa Peninsula',
   'active', '2026-07-01', '2026-07-15', '🌿', '#064e3b', '#065f46', '#047857'),

  ('20000000-0000-0000-0000-000000000002', 'indonesien-2028', '00000000-0000-0000-0000-000000000001',
   'Indonesien 2028', 'Dubai · Bali · Sumba · Ubud',
   'planned', '2028-07-15', '2028-07-30', '🌴', '#064e3b', '#0f766e', '#0891b2'),

  ('20000000-0000-0000-0000-000000000003', 'japan-2025', '00000000-0000-0000-0000-000000000001',
   'Japan 2025', 'Tokyo · Kyoto · Osaka',
   'completed', '2025-03-20', '2025-04-05', '🌸', '#4c0519', '#9f1239', '#be185d'),

  ('20000000-0000-0000-0000-000000000004', 'sardinien-2024', '00000000-0000-0000-0000-000000000001',
   'Sardinien 2024', 'Cagliari · Costa Smeralda · Alghero',
   'completed', '2024-08-01', '2024-08-15', '🏖️', '#1e3a5f', '#0369a1', '#0e7490')
ON CONFLICT (id) DO NOTHING;

-- ─── Etappen Costa Rica 2026 ────────────────────────────────────────────────

INSERT INTO stages (id, trip_id, title, location, start_date, end_date, nights, accommodation, notes, sort_order) VALUES
  ('30000000-0000-0000-0001-000000000001', '20000000-0000-0000-0000-000000000001',
   'Guanacaste', 'Guanacaste, Costa Rica', '2026-07-01', '2026-07-06', 5,
   'Westin Reserva Conchal', 'Strand, Natur, Entspannung', 1),
  ('30000000-0000-0000-0001-000000000002', '20000000-0000-0000-0000-000000000001',
   'La Fortuna', 'La Fortuna, Costa Rica', '2026-07-06', '2026-07-10', 4,
   'Nayara Springs', 'Arenal Vulkan, Wasserfall, Hängebrücken', 2),
  ('30000000-0000-0000-0001-000000000003', '20000000-0000-0000-0000-000000000001',
   'Osa Peninsula', 'Osa Peninsula, Costa Rica', '2026-07-10', '2026-07-15', 5,
   'Lapa Rios Lodge', 'Regenwald, Tiere, Strand', 3)
ON CONFLICT (id) DO NOTHING;

-- ─── Etappen Indonesien 2028 ────────────────────────────────────────────────

INSERT INTO stages (id, trip_id, title, location, start_date, end_date, nights, accommodation, notes, sort_order) VALUES
  ('30000000-0000-0000-0002-000000000001', '20000000-0000-0000-0000-000000000002',
   'Dubai', 'Dubai, UAE', '2028-07-15', '2028-07-17', 2,
   'Atlantis The Palm', 'Stopover — Burj Khalifa & Dubai Mall', 1),
  ('30000000-0000-0000-0002-000000000002', '20000000-0000-0000-0000-000000000002',
   'Bali', 'Bali, Indonesien', '2028-07-17', '2028-07-22', 5,
   'Alaya Resort Ubud', 'Strand, Reisterrassen, Tanah Lot Tempel', 2),
  ('30000000-0000-0000-0002-000000000003', '20000000-0000-0000-0000-000000000002',
   'Sumba', 'Sumba, Indonesien', '2028-07-22', '2028-07-25', 3,
   'Nihi Sumba', 'Surfen, Waingarpu Wasserfall, Pferde', 3),
  ('30000000-0000-0000-0002-000000000004', '20000000-0000-0000-0000-000000000002',
   'Ubud', 'Ubud, Bali', '2028-07-25', '2028-07-29', 4,
   'Four Seasons Sayan', 'Reisfelder, Kochen, Yoga, Affenwald', 4),
  ('30000000-0000-0000-0002-000000000005', '20000000-0000-0000-0000-000000000002',
   'Dubai', 'Dubai, UAE', '2028-07-29', '2028-07-30', 1,
   'Marriott Downtown', 'Rückreise-Stopp', 5)
ON CONFLICT (id) DO NOTHING;

-- ─── Etappen Japan 2025 ─────────────────────────────────────────────────────

INSERT INTO stages (id, trip_id, title, location, start_date, end_date, nights, accommodation, notes, sort_order) VALUES
  ('30000000-0000-0000-0003-000000000001', '20000000-0000-0000-0000-000000000003',
   'Tokyo', 'Tokyo, Japan', '2025-03-20', '2025-03-27', 7,
   'Park Hyatt Tokyo', 'Shibuya, Shinjuku, Akihabara, Teamlab Planets', 1),
  ('30000000-0000-0000-0003-000000000002', '20000000-0000-0000-0000-000000000003',
   'Kyoto', 'Kyoto, Japan', '2025-03-27', '2025-04-01', 5,
   'Nishiyama Onsen Keiunkan', 'Kirschblüten, Fushimi Inari, Gion', 2),
  ('30000000-0000-0000-0003-000000000003', '20000000-0000-0000-0000-000000000003',
   'Osaka', 'Osaka, Japan', '2025-04-01', '2025-04-05', 4,
   'The St. Regis Osaka', 'Dotonbori, Street Food, Universal Studios Japan', 3)
ON CONFLICT (id) DO NOTHING;

-- ─── Etappen Sardinien 2024 ─────────────────────────────────────────────────

INSERT INTO stages (id, trip_id, title, location, start_date, end_date, nights, accommodation, notes, sort_order) VALUES
  ('30000000-0000-0000-0004-000000000001', '20000000-0000-0000-0000-000000000004',
   'Cagliari', 'Cagliari, Sardinien', '2024-08-01', '2024-08-04', 3,
   'T Hotel Cagliari', 'Altstadt, Poetto-Strand, Salzteich', 1),
  ('30000000-0000-0000-0004-000000000002', '20000000-0000-0000-0000-000000000004',
   'Costa Smeralda', 'Porto Cervo, Sardinien', '2024-08-04', '2024-08-10', 6,
   'Villa Olga (privat)', 'Cala di Volpe, Capriccioli, Liscia Ruja', 2),
  ('30000000-0000-0000-0004-000000000003', '20000000-0000-0000-0000-000000000004',
   'Alghero', 'Alghero, Sardinien', '2024-08-10', '2024-08-15', 5,
   'Hotel El Balear', 'Altstadt, Capo Caccia, Grotta di Nettuno', 3)
ON CONFLICT (id) DO NOTHING;

-- ─── trip_members: alle 5 Personen für alle 4 Reisen ────────────────────────

INSERT INTO trip_members (trip_id, person_id) VALUES
  -- Costa Rica 2026
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005'),
  -- Indonesien 2028
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005'),
  -- Japan 2025
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005'),
  -- Sardinien 2024
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;
