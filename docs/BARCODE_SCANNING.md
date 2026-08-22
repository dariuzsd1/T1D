# Barcode scanning

The **Add a supply** page can scan the barcode on a box or pharmacy label using
your device's camera. It decodes in pure JavaScript with
[ZXing](https://github.com/zxing-js/library) (`@zxing/browser` + `@zxing/library`),
so it works anywhere `getUserMedia` does — **including iOS Safari, iOS Chrome, and
Firefox**, which the browser's native `BarcodeDetector` API does not cover.

> Why not the native Barcode Detection API? It's absent on iOS entirely and on
> desktop Chrome outside macOS/ChromeOS. An earlier version relied on it and failed
> on most devices; the switch to ZXing is deliberate — see
> [`src/components/scan/BarcodeScanner.tsx`](../src/components/scan/BarcodeScanner.tsx).

## What it does

1. Opens your rear camera and looks for a barcode (UPC/EAN, Code 128, GS1
   DataMatrix, QR, and more). The shared decoder config lives in
   [`src/lib/barcode.ts`](../src/lib/barcode.ts).
2. Decodes it and, if the label is a **GS1** barcode (most pharmacy/medical
   labels are), reads the structured fields out of it
   ([`src/lib/gs1.ts`](../src/lib/gs1.ts)):
   - **GTIN** — the product number (the join key for catalog lookup).
   - **Expiration date** — auto-filled into the form (you'll see "Read from the
     barcode"). Nothing is guessed — if the code doesn't carry a date, the field
     stays empty. This is the *only* honest source of expiry, because it's
     specific to that exact box.
   - **Lot number** — captured for reference.
3. Looks the **GTIN up in the product catalog** (see below) and, on a hit,
   auto-fills the **name, brand, category, quantity (units per box), and wear
   rate** — every field stays editable.
4. You confirm and tap **Add to inventory**.

The GS1 parsing logic is pure, dependency-free, and honest: it only surfaces a
field it actually decoded (CLAUDE.md §9.1).

## Codes from other countries (devices vs. medicines)

You don't pick a country — the code is self-describing, and
[`src/lib/supplyCode.ts`](../src/lib/supplyCode.ts) sniffs the syntax and dispatches:

- **Medical devices** (pumps, sensors, sets, reservoirs) are globally harmonized
  on **GS1** UDI in both the US (FDA) and EU (MDR): a `(01)(17)(10)` element
  string, read by [`src/lib/gs1.ts`](../src/lib/gs1.ts). Works worldwide.
- **Medicines** vary. The US (DSCSA) and most of the EU (FMD) also use GS1. But
  **Germany's securPharm** allows an IFA **PPN** code (`9N`/`1T`/`S`/`D` data
  identifiers — a different standard), read by [`src/lib/ppn.ts`](../src/lib/ppn.ts).

Both paths normalize into one `SupplyCode` and, crucially, recover a **national
join key**: the German **PZN** is pulled out of a PPN, or out of an **NTIN** (a
GTIN that embeds the PZN behind GS1's `4150` prefix). The catalog stores a `pzn`
column alongside `gtin`, so the *same* product matches whichever country's code is
on the box. Lookup is by GTIN when present, else by PZN
([`/api/scan/lookup`](../src/app/api/scan/lookup/route.ts)).

Not yet handled: US NDC / French CIP extraction, and one product carrying several
GTINs (regional/pack variants, or a GTIN's packaging indicator digit). The clean
fix is a `product_codes` join table — see `supabase/seed_user_boxes.sql`.

## GTIN → product: the catalog lookup

A scanned GTIN is resolved against the Supabase **`products`** table via
[`/api/scan/lookup`](../src/app/api/scan/lookup/route.ts) →
[`src/lib/catalog.ts`](../src/lib/catalog.ts). The catalog is seeded from
[`data/diabetes_catalog.csv`](../data/diabetes_catalog.csv) and supplies the
product-level facts a barcode implies:

| Field the scan fills | Catalog column |
|---|---|
| Brand | `brand` |
| Type / category | `category` |
| How many are in the box | `units_per_box` |
| How long each one lasts (wear) | `typical_usage_per_day` (runway = qty × days) |

**There is no third-party product API.** openFDA/GUDID was evaluated and rejected
as unreliable for diabetes consumables (it returns the wrong product — a
transmitter for a sensor GTIN, orthopedic implants for "Guardian 4", and insulins
aren't devices at all). Per the honesty rule, a wrong GTIN is worse than a blank
one, so the catalog is curated instead. See
[`docs/PRODUCT_CATALOG.md`](./PRODUCT_CATALOG.md).

### Coverage — the real bottleneck

The catalog has ~130 products but only some carry a verified GTIN, so a scan of a
box that isn't covered yet won't auto-identify. That's handled gracefully, not as
a dead end:

- **Personal catalog fallback.** If the shared catalog doesn't know the code, the
  app checks whether *you* have scanned and named it before (matched by the
  `barcode` column on your own supplies) and reuses your confirmed product.
- **Name it once.** If it's brand new to you, you name it once; the real scanned
  GTIN is saved against the supply, so every future scan of that box is instant —
  and that scanned GTIN can later be merged into the shared catalog (it's the
  exact code from a real box, more reliable than any database).

Growing GTIN coverage is therefore mostly a matter of **scanning the boxes you
own** — see the "How to contribute" section in
[`docs/PRODUCT_CATALOG.md`](./PRODUCT_CATALOG.md).

## The photo path (also real)

"Add a photo" and "Take a photo" are **not** a mock. Both run the same ZXing
decoder on the still image ([`decodeBarcodeFromImage`](../src/lib/barcode.ts)); a
sharp close-up is often easier to read than a live webcam frame. On a hit it drops
into the same confirm flow as a live scan. On a miss, the photo stays as an
on-screen reference for manual entry — the app never guesses what the picture shows.

## Browser support

| Browser | Camera scan? |
|---|---|
| Chrome (Android & desktop) | ✅ Yes |
| Safari (iOS & macOS) | ✅ Yes |
| Firefox | ✅ Yes |

ZXing decodes in JavaScript, so support tracks camera access rather than any
vendor-specific barcode API. When the camera is unavailable or permission is
denied, the scanner shows a clear message and an **"Enter manually instead"**
button — never a dead end. Scanning requires a **secure context**: HTTPS (your
deployed site) or `localhost`. Cameras are blocked on plain `http://`.

## Stored fields

The scan saves the core supply plus, best-effort, the scanned **GTIN**
(`barcode`), **lot number** (`lot_number`), and detected **wear rate**
(`usage_rate_per_day`). These columns ship in
[`supabase/setup.sql`](../supabase/setup.sql) — no separate migration needed. They
power reorder matching, recall checks, and an honest runway from the first scan
(a 35-day sensor isn't treated as a 1-unit/day item). Writing them is best-effort:
if a column is somehow missing, the core supply still saves and a one-line console
note is logged.

## Notes / next steps

- **Widen GTIN coverage** — the highest-leverage improvement for a true
  point-and-log experience. Driven by real scanned boxes, not bulk FDA imports.
- **Catalog refresh automation** is sketched (not built) in
  [`docs/PRODUCT_CATALOG.md`](./PRODUCT_CATALOG.md): a GitHub Actions cron that
  proposes GTIN updates via PR for human review, never auto-merging medical data.
