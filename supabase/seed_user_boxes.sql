-- Verified product codes scanned from real boxes (2026-08-22).
-- The most reliable GTIN/PZN is the one printed on a box you own
-- (docs/PRODUCT_CATALOG.md), so these are seeded with high trust.
-- Idempotent: every statement no-ops on re-run. Run in the Supabase SQL editor.
-- Reference data only, not PHI.
--
-- SELF-SUFFICIENT: section 0 creates every column and table this file needs, so
-- you do NOT have to run setup.sql first. Codes are inserted BOTH into
-- product_codes (the real key: one product ↔ many codes, with a per-code pack
-- size) and, where the legacy single-code column is still empty, into
-- products.gtin / products.pzn, so both lookup paths agree during migration.

-- ---------------------------------------------------------------------------
-- 0. PREREQUISITES. This file used to assume setup.sql had already been re-run,
--    and failed with 'column "discontinued" does not exist' if it had not. It now
--    creates everything it needs, so this file alone is enough. All of it is
--    idempotent: nothing is dropped, nothing is overwritten.
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- Columns the scanner and the accuracy pass rely on.
alter table public.products add column if not exists pzn          text;
alter table public.products add column if not exists discontinued boolean not null default false;
alter table public.supplies add column if not exists barcode      text;
alter table public.supplies add column if not exists pzn          text;
alter table public.supplies add column if not exists lot_number   text;
alter table public.supplies add column if not exists discontinued boolean not null default false;

-- `products` is shared reference data, not PHI: it must have Row Level Security
-- ON with a read-only policy, so signed-in clients can look products up but
-- nobody can write to it. Stated explicitly here so that turning RLS on (by this
-- file, or by the Supabase editor's own prompt) can never leave the catalog
-- unreadable and silently break product lookup. An existing policy is left
-- untouched rather than dropped and recreated, in case it has been customised.
alter table public.products enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products'
      and policyname = 'products public read'
  ) then
    create policy "products public read" on public.products
      for select using (true);
  end if;
end $$;


-- One product can carry many codes (regional GTIN variants, a pack-level GTIN, a
-- German PZN, a US NDC, a French CIP), which a single column cannot hold.
create table if not exists public.product_codes (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  code_type     text not null check (code_type in ('gtin','pzn','ndc','cip')),
  code          text not null,
  -- Pack size for THIS code when it differs from the product default.
  units_per_box integer,
  source        text,
  last_verified date,
  created_at    timestamptz not null default now(),
  unique (code_type, code)
);

create index if not exists product_codes_product_id_idx on public.product_codes(product_id);
create index if not exists product_codes_lookup_idx     on public.product_codes(code_type, code);
create index if not exists products_pzn_idx             on public.products(pzn) where pzn is not null;

alter table public.product_codes enable row level security;

-- Reference data only, no PHI: any signed-in user may read, nobody writes.
drop policy if exists "product_codes public read" on public.product_codes;
create policy "product_codes public read" on public.product_codes
  for select using (true);


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

-- 2. MiniMed Reservoir - Kit (REF MMT-1031). The name and the 2x20 = 40 count are
--    read off the user's own box, so the Kit is its OWN catalog product, distinct
--    from the generic 10-count reservoir entry. An earlier version of this file
--    pinned the Kit's GTIN onto the generic row, which made a Kit scan report the
--    wrong product name and box count; the first statement undoes that.
update public.products set gtin = null
  where product_name = 'MiniMed Reservoir' and gtin = '00763000532222';

insert into public.products
  (category, brand, product_name, common_names, gtin, unit, units_per_box,
   typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'infusion_set', 'Medtronic', 'MiniMed Reservoir - Kit',
         'minimed reservoir kit|reservoir kit|mmt-1031', '00763000532222', 'reservoirs', 40,
         0.33, 90, true,
         'REF MMT-1031. Carton of 2x20 = 40. Name and count read off the box'
  where not exists (select 1 from public.products where product_name = 'MiniMed Reservoir - Kit');

insert into public.product_codes (product_id, code_type, code, units_per_box, source, last_verified)
  select id, 'gtin', '00763000532222', 40, 'scanned from box (2x20 carton)', '2026-08-23'
  from public.products where product_name = 'MiniMed Reservoir - Kit'
  and not exists (select 1 from public.product_codes where code_type = 'gtin' and code = '00763000532222');

-- Re-point a code row created by the earlier version of this file at the Kit.
update public.product_codes pc
  set product_id = k.id, units_per_box = 40
  from public.products k
  where k.product_name = 'MiniMed Reservoir - Kit'
    and pc.code_type = 'gtin' and pc.code = '00763000532222'
    and pc.product_id <> k.id;

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

-- 5. Catalog accuracy pass, verified 2026-08-23 against manufacturer sources.
--
--    Discontinued products stay in the catalog so stock a user still holds keeps
--    scanning and identifying; the flag is what stops the app suggesting a reorder.
update public.products set discontinued = true
  where product_name in (
    'Dexcom G6 Sensor',
    'Dexcom G6 Transmitter',
    'FreeStyle Libre 2 Sensor',
    'FreeStyle Libre 3 Sensor',
    'Glucagon Emergency Kit',
    'Guardian Link Transmitter',
    'Levemir (insulin detemir)',
    'MiniMed 770G Pump',
    'Semglee (insulin glargine)',
    'Symlin (pramlintide)'
  );

-- Name corrections: use the name the manufacturer actually prints.
update public.products set product_name = 'MiniMed Extended Infusion Set'
  where product_name = 'Extended Infusion Set';
update public.products set product_name = 'Tandem Mobi System'
  where product_name = 'Tandem Mobi Pump';
update public.products set product_name = 'Stelo Glucose Biosensor'
  where product_name = 'Dexcom Stelo Sensor';
update public.products set product_name = 'FreeStyle Libre 2 Reader'
  where product_name = 'FreeStyle Libre Reader';
update public.products set product_name = 'Accu-Chek Aviva Plus Test Strips'
  where product_name = 'Accu-Chek Aviva Test Strips';
update public.products set product_name = 'FreeStyle Precision Blood Ketone Test Strips'
  where product_name = 'Precision/FreeStyle Blood Ketone Strips';
update public.products set product_name = 'mylife YpsoPump Reservoir'
  where product_name = 'mylife YpsoPump Cartridge';
update public.products set product_name = 'mylife YpsoPump Orbit Infusion Set'
  where product_name = 'mylife Orbit Infusion Set';

-- Brand corrections (ownership or company naming changed since first written).
update public.products set brand = 'Amphastar'
  where product_name = 'Baqsimi (nasal glucagon)' and brand <> 'Amphastar';
update public.products set brand = 'Zealand Pharma'
  where product_name = 'Zegalogue (dasiglucagon)' and brand <> 'Zealand Pharma';
update public.products set brand = 'Sequel Med Tech'
  where product_name = 'twiist Insulin Pump' and brand <> 'Sequel Med Tech';
update public.products set brand = 'Xeris Pharmaceuticals'
  where product_name = 'Gvoke HypoPen (glucagon)' and brand <> 'Xeris Pharmaceuticals';
update public.products set brand = 'Torbot'
  where product_name = 'Skin Tac Adhesive Wipes' and brand <> 'Torbot';

-- Medtronic spun its diabetes business out as MiniMed, listed on Nasdaq
-- 2026-03-06. Rebrand those rows, but keep "medtronic" searchable: boxes already
-- in a cupboard still say Medtronic, and users will type it.
update public.products set brand = 'MiniMed' where brand = 'Medtronic';
update public.products
  set common_names = case when coalesce(common_names, '') = '' then 'medtronic'
                          else common_names || '|medtronic' end
  where brand = 'MiniMed' and coalesce(common_names, '') not like '%medtronic%';

-- Products the catalog was missing entirely.
insert into public.products
  (category, brand, product_name, common_names, unit, units_per_box, typical_usage_per_day, rx_required, notes)
  select 'bg_supply', 'Roche', 'Accu-Chek Guide Link Meter', 'guide link|accu-chek guide link|accuchek guide link', 'devices', 1, null, false,
         'BG meter that pairs with the MiniMed 770G and 780G pumps for upload/calibration'
  where not exists (select 1 from public.products where product_name = 'Accu-Chek Guide Link Meter');

insert into public.products
  (category, brand, product_name, common_names, unit, units_per_box, typical_usage_per_day, rx_required, notes)
  select 'patch_pump', 'MiniMed', 'MiniMed Flex System', 'minimed flex|flex system|medtronic flex', 'devices', 1, null, true,
         'MiniMed''s smallest and only app-controlled AID pump. Ships in the US paired with the Instinct sensor'
  where not exists (select 1 from public.products where product_name = 'MiniMed Flex System');

insert into public.products
  (category, brand, product_name, common_names, unit, units_per_box, typical_usage_per_day, rx_required, notes)
  select 'cgm_sensor', 'Abbott', 'Instinct Sensor', 'instinct|instinct sensor|minimed instinct', 'sensors', 1, 0.067, true,
         'Up to 15-day wear = ~0.067/day. Made by Abbott for the MiniMed 780G and Flex systems'
  where not exists (select 1 from public.products where product_name = 'Instinct Sensor');

insert into public.products
  (category, brand, product_name, common_names, unit, units_per_box, rx_required, notes)
  select 'bg_supply', 'LifeScan', 'OneTouch Delica Plus Lancing Device',
         'delica|delica plus|onetouch delica', 'devices', 1, false,
         'Lancing device taking OneTouch Delica Plus lancets (30G and 33G)'
  where not exists (select 1 from public.products where product_name = 'OneTouch Delica Plus Lancing Device');

insert into public.products
  (category, brand, product_name, common_names, unit, units_per_box, rx_required, notes)
  select 'bg_supply', 'LifeScan', 'OneTouch Delica Plus Lancets',
         'delica lancets|delica plus lancets|onetouch lancets', 'lancets', 100, false,
         'Available in 30G and 33G. Per-person usage: one per fingerstick'
  where not exists (select 1 from public.products where product_name = 'OneTouch Delica Plus Lancets');

-- ----------------------------------------------------------------------------
-- Still open (not blocking): US NDC / French CIP extraction from a scan, and a
-- GTIN-indicator-digit normalizer so a case vs. a single box match the same
-- product. Both slot cleanly into product_codes when needed.
