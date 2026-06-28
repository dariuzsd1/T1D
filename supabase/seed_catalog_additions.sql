-- Catalog additions (2026-06-29 expert review pass): 26 products.
-- Idempotent: each insert is skipped if a product with that name already exists.
-- Run in the Supabase SQL editor. Reference data only, not PHI.

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Tandem', 't:slim X2 Insulin Pump', 'tslim x2|t slim x2|tandem x2|tslim', null, 'devices', 1, null, null, true, 'Durable tubed AID pump (equipment). Uses t:slim cartridges + infusion sets'
  where not exists (select 1 from public.products where product_name = 't:slim X2 Insulin Pump');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Tandem', 'Tandem Mobi Pump', 'tandem mobi|mobi pump', null, 'devices', 1, null, null, true, 'Durable miniature AID pump. Uses Mobi cartridges + infusion sets'
  where not exists (select 1 from public.products where product_name = 'Tandem Mobi Pump');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Medtronic', 'MiniMed 780G Pump', 'minimed 780g|780g|medtronic 780g', null, 'devices', 1, null, null, true, 'Durable AID pump. Uses reservoirs + infusion sets + Guardian sensors'
  where not exists (select 1 from public.products where product_name = 'MiniMed 780G Pump');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Medtronic', 'MiniMed 770G Pump', 'minimed 770g|770g', null, 'devices', 1, null, null, true, 'Durable AID pump (predecessor to the 780G)'
  where not exists (select 1 from public.products where product_name = 'MiniMed 770G Pump');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Ypsomed', 'mylife YpsoPump', 'ypsopump|mylife pump', null, 'devices', 1, null, null, true, 'Durable pump (EU/intl). Uses YpsoPump cartridges + Orbit sets'
  where not exists (select 1 from public.products where product_name = 'mylife YpsoPump');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Insulet', 'Omnipod 5 Controller', 'omnipod 5 pdm|op5 controller|omnipod controller', null, 'devices', 1, null, null, true, 'Handheld controller for Omnipod 5 (or use the phone app)'
  where not exists (select 1 from public.products where product_name = 'Omnipod 5 Controller');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'patch_pump', 'Sequel', 'twiist Insulin Pump', 'twiist|sequel twiist', null, 'devices', 1, null, null, true, 'Durable AID pump (2025). Works with FreeStyle Libre 3 Plus'
  where not exists (select 1 from public.products where product_name = 'twiist Insulin Pump');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'cgm_sensor', 'Abbott', 'FreeStyle Libre Reader', 'libre reader|freestyle reader', null, 'devices', 1, null, null, true, 'Optional handheld reader for users who don''t scan with a phone'
  where not exists (select 1 from public.products where product_name = 'FreeStyle Libre Reader');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'cgm_sensor', 'Dexcom', 'Dexcom Receiver', 'dexcom receiver|g6 receiver|g7 receiver', null, 'devices', 1, null, null, true, 'Optional receiver for users who don''t use a phone (G6/G7)'
  where not exists (select 1 from public.products where product_name = 'Dexcom Receiver');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'infusion_set', 'Medtronic', 'Mio 30 Infusion Set', 'mio 30|medtronic mio 30', null, 'sets', 10, 0.33, 90, true, 'All-in-one angled soft cannula. ~3-day change'
  where not exists (select 1 from public.products where product_name = 'Mio 30 Infusion Set');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'infusion_set', 'Unomedical', 'Comfort Infusion Set', 'comfort|contact detach|unomedical comfort', null, 'sets', 10, 0.33, 90, true, 'Angled soft cannula (Contact Detach / Silhouette-type). ~3-day change'
  where not exists (select 1 from public.products where product_name = 'Comfort Infusion Set');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'insulin', 'MannKind', 'Afrezza (inhaled insulin)', 'afrezza|inhaled insulin', null, 'cartridges', 90, null, 30, true, 'Ultra-rapid INHALED insulin. Per-person dosing. Cartridge cards (4/8/12u)'
  where not exists (select 1 from public.products where product_name = 'Afrezza (inhaled insulin)');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'insulin', 'Eli Lilly', 'Rezvoglar (insulin glargine)', 'rezvoglar', null, 'pens', 5, null, 30, true, 'Long-acting basal (glargine biosimilar, interchangeable with Lantus). Per-person dosing'
  where not exists (select 1 from public.products where product_name = 'Rezvoglar (insulin glargine)');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'insulin', 'Sanofi', 'Merilog (insulin aspart)', 'merilog', null, 'vials', 1, null, 30, true, 'Rapid-acting aspart biosimilar (approved 2025). Per-person dosing'
  where not exists (select 1 from public.products where product_name = 'Merilog (insulin aspart)');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'insulin', 'AstraZeneca', 'Symlin (pramlintide)', 'symlin|pramlintide|symlinpen', null, 'pens', 1, null, 30, true, 'Amylin analog ADJUNCT (not insulin); a mealtime injection some T1Ds add. Per-person dosing'
  where not exists (select 1 from public.products where product_name = 'Symlin (pramlintide)');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'bg_supply', 'ReliOn', 'ReliOn Premier Test Strips', 'relion premier strips|relion strips|walmart strips', null, 'strips', 50, null, 90, false, 'Low-cost OTC strips (Walmart). Per-person usage'
  where not exists (select 1 from public.products where product_name = 'ReliOn Premier Test Strips');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'bg_supply', 'ReliOn', 'ReliOn Premier BLU Meter', 'relion premier|relion blu|relion meter', null, 'devices', 1, null, null, false, 'Low-cost OTC Bluetooth BG meter (Walmart)'
  where not exists (select 1 from public.products where product_name = 'ReliOn Premier BLU Meter');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'bg_supply', 'Ascensia', 'Contour Next Link 2.4 Meter', 'contour next link|next link 2.4', null, 'devices', 1, null, null, false, 'BG meter that links to Medtronic pumps for upload/calibration'
  where not exists (select 1 from public.products where product_name = 'Contour Next Link 2.4 Meter');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'bg_supply', 'Roche', 'Accu-Chek Instant Test Strips', 'accu-chek instant|accuchek instant strips', null, 'strips', 50, null, 90, true, 'Per-person usage'
  where not exists (select 1 from public.products where product_name = 'Accu-Chek Instant Test Strips');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'glucagon', 'Eli Lilly', 'Glucagon Emergency Kit', 'glucagon kit|lilly glucagon|red box glucagon', null, 'kits', 1, null, 365, true, 'Traditional injectable rescue kit (reconstitute powder + syringe). Track EXPIRATION'
  where not exists (select 1 from public.products where product_name = 'Glucagon Emergency Kit');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'skin_care', '3M', 'Tegaderm Transparent Dressing', 'tegaderm|transparent dressing|film dressing', null, 'dressings', 100, null, null, false, 'Clear film dressing to secure or overlay sensors and sets'
  where not exists (select 1 from public.products where product_name = 'Tegaderm Transparent Dressing');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'skin_care', 'Eloquest', 'Mastisol Liquid Adhesive', 'mastisol|liquid adhesive', null, 'bottles', 1, null, null, false, 'Medical liquid adhesive to improve sensor/set stick'
  where not exists (select 1 from public.products where product_name = 'Mastisol Liquid Adhesive');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'skin_care', 'Smith+Nephew', 'OpSite Flexifix Tape', 'opsite|flexifix|opsite flexifix', null, 'rolls', 1, null, null, false, 'Adhesive film roll cut to overlay sensors/sets'
  where not exists (select 1 from public.products where product_name = 'OpSite Flexifix Tape');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'other', 'Frio', 'Frio Insulin Cooling Wallet', 'frio|insulin cooler|cooling wallet', null, 'wallets', 1, null, null, false, 'Evaporative (water-activated) insulin cooling for travel; reusable, no fridge'
  where not exists (select 1 from public.products where product_name = 'Frio Insulin Cooling Wallet');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'other', 'Generic', 'Insulin Travel Cooler', 'insulin travel case|insulin cooler case', null, 'cases', 1, null, null, false, 'Insulated case for transporting insulin'
  where not exists (select 1 from public.products where product_name = 'Insulin Travel Cooler');

insert into public.products (category, brand, product_name, common_names, gtin, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, rx_required, notes)
  select 'other', 'Medtronic', 'Pump AA Battery', 'pump battery|aa battery', null, 'batteries', 2, null, null, false, 'Some MiniMed pumps use a single AA (lithium recommended); keep spares'
  where not exists (select 1 from public.products where product_name = 'Pump AA Battery');
