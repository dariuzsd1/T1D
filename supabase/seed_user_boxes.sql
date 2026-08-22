-- Verified product codes scanned from real boxes (2026-08-22).
-- The most reliable GTIN/PZN is the one printed on a box you own
-- (docs/PRODUCT_CATALOG.md), so these are seeded with high trust.
-- Idempotent: every statement no-ops on re-run. Run in the Supabase SQL editor.
-- Reference data only, not PHI.
--
-- Requires the product_codes table (run supabase/setup.sql first). Codes are
-- inserted BOTH into product_codes (the real key: one product ↔ many codes, with
-- a per-code pack size) and, where the legacy single-code column is still empty,
-- into products.gtin/products.pzn so both lookup paths agree during migration.

-- Helper pattern below: link a code to a product by name via a subquery, skipping
-- if that (code_type, code) already exists.

-- 1. Guardian 4 Sensor — GS1 UDI (device). This GTIN carries indicator digit "2"
--    (a German pack level); other regions may print the base-unit GTIN. With
--    product_codes we can add each variant as its own row over time.
insert into public.product_codes (product_id, code_type, code, source, last_verified)
  select id, 'gtin', '20763000413396', 'scanned from box', '2026-08-22'
  from public.products where product_name = 'Guardian 4 Sensor'
  and not exists (select 1 from public.product_codes where code_type = 'gtin' and code = '20763000413396');
update public.products set gtin = '20763000413396'
  where product_name = 'Guardian 4 Sensor' and gtin is null;

-- 2. MiniMed Reservoir (REF MMT-1031) — GS1 UDI. The scanned box is a special
--    carton of 2x20 = 40 reservoirs, so this code pins units_per_box = 40 even
--    though the generic product row defaults to 10.
insert into public.product_codes (product_id, code_type, code, units_per_box, source, last_verified)
  select id, 'gtin', '00763000532222', 40, 'scanned from box (2x20 carton)', '2026-08-22'
  from public.products where product_name = 'MiniMed Reservoir'
  and not exists (select 1 from public.product_codes where code_type = 'gtin' and code = '00763000532222');
update public.products set gtin = '00763000532222'
  where product_name = 'MiniMed Reservoir' and gtin is null;

-- 3. Mio Advance Infusion Set — the multi-GTIN case product_codes was built for.
--    BOTH the catalog's original GTIN and the code scanned from this box map to
--    the same product, so either scan now auto-fills.
insert into public.product_codes (product_id, code_type, code, source, last_verified)
  select id, 'gtin', '05705244016293', 'GUDID', '2026-06-18'
  from public.products where product_name = 'Mio Advance Infusion Set'
  and not exists (select 1 from public.product_codes where code_type = 'gtin' and code = '05705244016293');
insert into public.product_codes (product_id, code_type, code, source, last_verified)
  select id, 'gtin', '05705244018877', 'scanned from box', '2026-08-22'
  from public.products where product_name = 'Mio Advance Infusion Set'
  and not exists (select 1 from public.product_codes where code_type = 'gtin' and code = '05705244018877');

-- 4. Humalog 100, 5x10 ml vials — a German medicine (no GTIN on the box). It
--    carries an IFA PPN whose embedded PZN is 07242491; the small linear PZN
--    barcode carries the bare number. Either now resolves by PZN. The code row
--    pins the 5-vial pack size and points at the dedicated presentation row.
insert into public.products
  (category, brand, product_name, common_names, gtin, pzn, unit, units_per_box,
   typical_usage_per_day, default_refill_interval_days, rx_required, in_use_days, notes)
  select 'insulin', 'Eli Lilly', 'Humalog 100 (5x10 ml vials, DE)',
         'humalog 100|humalog vials|humalog dsfl', null, '07242491', 'vials', 5,
         null, 30, true, 28,
         'Rapid-acting lispro U-100. German 5x10 ml vial pack (PZN 07242491). 28-day in-use clock. Per-person dosing (collect TDD at onboarding)'
  where not exists (select 1 from public.products where pzn = '07242491')
    and not exists (select 1 from public.products where product_name = 'Humalog 100 (5x10 ml vials, DE)');
insert into public.product_codes (product_id, code_type, code, units_per_box, source, last_verified)
  select id, 'pzn', '07242491', 5, 'scanned from box (PZN)', '2026-08-22'
  from public.products where product_name = 'Humalog 100 (5x10 ml vials, DE)'
  and not exists (select 1 from public.product_codes where code_type = 'pzn' and code = '07242491');

-- ----------------------------------------------------------------------------
-- Still open (not blocking): US NDC / French CIP extraction from a scan, and a
-- GTIN-indicator-digit normalizer so a case vs. a single box match the same
-- product. Both slot cleanly into product_codes when needed.
