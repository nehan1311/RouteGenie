-- RouteGenie Seed Data
-- Schema-verified: tested against actual DB schema (June 2026)
-- Territory: Andheri West, Mumbai
-- Reps: Raj, Priya, Anil | Stores: 20 | Visit logs: 30
PRAGMA foreign_keys = ON;

DELETE FROM visit_logs;
DELETE FROM route_entries;
DELETE FROM reps;
DELETE FROM stores;

-- ============================
-- REPS
-- best_time_window_start/end = hour integer (24h)
-- dna_profile = JSON with conversion_rates per store_type
-- ============================
INSERT INTO reps (id, name, avg_visit_time_minutes, best_time_window_start, best_time_window_end, area_speed_factor, dna_profile) VALUES
(1, 'Raj',   12, 9,  11, 0.9, '{"conversion_rates": {"kirana": 0.65, "medical": 0.25, "supermarket": 0.30, "distributor": 0.20}, "notes": "Experienced with small traditional retail outlets."}'),
(2, 'Priya', 15, 10, 12, 1.0, '{"conversion_rates": {"kirana": 0.20, "medical": 0.35, "supermarket": 0.70, "distributor": 0.40}, "notes": "Specializes in large modern trade and supermarkets."}'),
(3, 'Anil',  18, 11, 13, 1.2, '{"conversion_rates": {"kirana": 0.15, "medical": 0.75, "supermarket": 0.25, "distributor": 0.30}, "notes": "Strong background in pharma and medical stores."}');

-- ============================
-- STORES (20 stores in Andheri West, Mumbai)
-- avg_order_value in INR derived from source FMCG dataset
-- kirana=58963 | supermarket=43364 | medical=64343 | distributor=98138
-- ============================
INSERT INTO stores (id, name, lat, lng, store_type, avg_order_value, base_priority, last_visited_date, stock_depletion_rate, closed_days) VALUES
-- KIRANA (8 stores) base_priority = 1
  (1,  'Maruti Kirana & General Store',    19.1423, 72.8363, 'kirana', 58963.89, 1, '2026-06-13', 0.13, 'Sunday'),
  (2,  'Aapla Kirana Store',    19.1376, 72.8313, 'kirana', 58963.89, 1, '2026-06-10', 0.15, 'None'),
  (3,  'Shree Ganesh Provision Store',    19.1405, 72.8337, 'kirana', 58963.89, 1, '2026-06-09', 0.12, 'Monday'),
  (4,  'New Bombay General Stores',    19.1353, 72.8358, 'kirana', 58963.89, 1, '2026-06-14', 0.10, 'None'),
  (5,  'Mumbai Bazaar Kirana',    19.1446, 72.8303, 'kirana', 58963.89, 1, '2026-06-08', 0.18, 'Sunday'),
  (6,  'Laxmi Traders',    19.1388, 72.8370, 'kirana', 58963.89, 1, '2026-06-11', 0.14, 'None'),
  (7,  'Om Sai Provision Mart',    19.1414, 72.8275, 'kirana', 58963.89, 1, '2026-06-07', 0.11, 'Monday'),
  (8,  'Vitthal General Store',    19.1362, 72.8332, 'kirana', 58963.89, 1, '2026-06-12', 0.16, 'None'),
-- SUPERMARKET (4 stores) base_priority = 3
  (9,  'D-Mart Andheri',    19.1367, 72.8143, 'supermarket', 43364.15, 3, '2026-06-15', 0.08, 'None'),
  (10,  'More Supermarket Andheri',    19.1397, 72.8202, 'supermarket', 43364.15, 3, '2026-06-14', 0.09, 'None'),
  (11,  'Reliance Smart Andheri',    19.1345, 72.8241, 'supermarket', 43364.15, 3, '2026-06-13', 0.07, 'None'),
  (12,  'Big Bazaar Andheri',    19.1324, 72.8185, 'supermarket', 43364.15, 3, '2026-06-12', 0.08, 'Monday'),
-- MEDICAL (5 stores) base_priority = 2
  (13,  'Apollo Pharmacy Andheri',    19.1378, 72.8295, 'medical', 64343.57, 2, '2026-06-15', 0.06, 'None'),
  (14,  'MedPlus Andheri',    19.1408, 72.8231, 'medical', 64343.57, 2, '2026-06-11', 0.05, 'None'),
  (15,  'Wellness Forever Andheri',    19.1358, 72.8347, 'medical', 64343.57, 2, '2026-06-15', 0.07, 'Sunday'),
  (16,  'Sahyadri Medical Stores',    19.1423, 72.8259, 'medical', 64343.57, 2, '2026-06-09', 0.06, 'None'),
  (17,  'Life Care Pharmacy',    19.1321, 72.8294, 'medical', 64343.57, 2, '2026-06-08', 0.08, 'Monday'),
-- DISTRIBUTOR (3 stores) base_priority = 3
  (18,  'Mumbai FMCG Distributors Pvt Ltd',    19.1333, 72.8205, 'distributor', 98138.58, 3, '2026-06-14', 0.05, 'None'),
  (19,  'Western India Wholesale Hub',    19.1449, 72.8377, 'distributor', 98138.58, 3, '2026-06-10', 0.05, 'Sunday'),
  (20,  'Andheri Trade & Supply Co.',    19.1386, 72.8170, 'distributor', 98138.58, 3, '2026-06-07', 0.05, 'None');

-- ============================
-- VISIT LOGS (30 historical visits)
-- Covers all 3 reps and a mix of outcomes for report generation realism
-- ============================
INSERT INTO visit_logs (id, rep_id, store_id, visited_at, outcome, revenue, notes) VALUES
-- Raj (kirana specialist)
(1,  1, 1,  '2026-06-13T09:15:00', 'order_placed', 61200.00, 'Pitched Sunfeast biscuits and Maggi noodles. Order placed for 80 units.'),
(2,  1, 2,  '2026-06-10T10:05:00', 'order_placed', 54800.00, 'Pitched Surf Excel and Vim. Order placed for 65 units.'),
(3,  1, 3,  '2026-06-09T09:40:00', 'closed',            0.00, 'Store closed - Monday. Will reschedule.'),
(4,  1, 4,  '2026-06-14T09:20:00', 'order_placed', 59500.00, 'Pitched Colgate and Dettol. Order placed for 72 units.'),
(5,  1, 5,  '2026-06-08T10:30:00', 'no_answer',         0.00, 'Owner not available. Left product catalog.'),
(6,  1, 6,  '2026-06-11T09:55:00', 'order_placed', 62100.00, 'Pitched Parle-G and Real juice. Order placed for 90 units.'),
(7,  1, 7,  '2026-06-07T10:15:00', 'order_placed', 57300.00, 'Pitched Horlicks and Boost. Order placed for 55 units.'),
(8,  1, 8,  '2026-06-12T09:35:00', 'skipped',           0.00, 'Owner requested visit next week.'),
-- Priya (supermarket specialist)
(9,  2, 9,  '2026-06-15T10:10:00', 'order_placed', 45200.00, 'Pitched PureLiva shampoo range. Order placed for 120 units.'),
(10, 2, 10, '2026-06-14T10:45:00', 'order_placed', 41800.00, 'Pitched BrightSmile toothpaste. Order placed for 95 units.'),
(11, 2, 11, '2026-06-13T11:00:00', 'order_placed', 44600.00, 'Pitched FreshNest body wash. Order placed for 110 units.'),
(12, 2, 12, '2026-06-12T10:20:00', 'closed',            0.00, 'Store closed for audit. Rescheduled to Thursday.'),
(13, 2, 1,  '2026-06-10T11:30:00', 'no_answer',         0.00, 'Manager unavailable. Left samples.'),
(14, 2, 18, '2026-06-14T10:00:00', 'order_placed', 95000.00, 'Bulk order negotiated for Surf Excel and Comfort. 200 units.'),
(15, 2, 20, '2026-06-12T11:15:00', 'order_placed',102400.00, 'Quarterly restocking order. Mixed SKUs across 3 brands.'),
-- Anil (medical specialist)
(16, 3, 13, '2026-06-15T11:05:00', 'order_placed', 68400.00, 'Pitched PureLiva Repair shampoo (pharma line). Order placed for 73 units.'),
(17, 3, 14, '2026-06-11T11:40:00', 'order_placed', 61200.00, 'Pitched BrightSmile Mint toothpaste. Order placed for 99 units.'),
(18, 3, 15, '2026-06-10T12:00:00', 'closed',            0.00, 'Store closed Sunday. Marked for Monday revisit.'),
(19, 3, 16, '2026-06-09T11:20:00', 'order_placed', 64800.00, 'Pitched FreshNest Citrus body wash. Order placed for 361 units bulk.'),
(20, 3, 17, '2026-06-08T11:55:00', 'order_placed', 59700.00, 'Pitched vitamin supplements range. Order placed for 48 units.'),
(21, 3, 13, '2026-06-08T12:10:00', 'order_placed', 71500.00, 'Repeat visit. Upsold OTC wellness range. 85 units.'),
(22, 3, 19, '2026-06-10T11:00:00', 'order_placed', 96200.00, 'Distributor restocking. Pharma + personal care mix.'),
(23, 3, 4,  '2026-06-09T12:30:00', 'no_answer',         0.00, 'Owner out for lunch. Revisit scheduled.'),
(24, 3, 7,  '2026-06-07T11:45:00', 'order_placed', 55800.00, 'Pitched health drink range. Order placed for 60 units.'),
-- Mixed cross-rep logs
(25, 1, 9,  '2026-06-11T09:00:00', 'order_placed', 38900.00, 'Cross-territory coverage. Snacks and beverages. 50 units.'),
(26, 2, 16, '2026-06-09T10:30:00', 'order_placed', 67200.00, 'Medical channel expansion visit. 78 units.'),
(27, 3, 11, '2026-06-08T11:00:00', 'skipped',           0.00, 'Queue too long. Rescheduled.'),
(28, 1, 18, '2026-06-07T10:00:00', 'order_placed', 89400.00, 'Distributor pitch for kirana SKUs. 180 units.'),
(29, 2, 5,  '2026-06-06T11:20:00', 'no_answer',         0.00, 'Sunday - store closed as expected.'),
(30, 3, 20, '2026-06-07T12:00:00', 'order_placed',104500.00, 'Large distributor quarterly order. Premium range. 250 units.');
