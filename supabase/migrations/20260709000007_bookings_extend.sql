-- Migration: erweitert bookings um die in Phase 5A geforderten Buchungstypen,
-- einen Zwischenstatus "reserviert" sowie Zahlungsstatus und Notizen.
-- Rein additiv, keine bestehenden Daten werden verändert oder gelöscht.

ALTER TYPE booking_type ADD VALUE 'restaurant';
ALTER TYPE booking_type ADD VALUE 'train';
ALTER TYPE booking_type ADD VALUE 'ferry';
ALTER TYPE booking_type ADD VALUE 'insurance';
ALTER TYPE booking_type ADD VALUE 'other';

ALTER TYPE booking_status ADD VALUE 'reserved';

ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));
ALTER TABLE bookings ADD COLUMN notes TEXT;
