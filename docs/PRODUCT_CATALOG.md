# Product Catalog — groundwork (mission, not a finished build)

> Status: **groundwork only.** This is a deliberately small starting point so we
> don't burn effort (or AI credits) re-deriving the same device/drug facts over
> and over. Fill it in over time; the app can lean on it later.

## The mission

Build one **CSV reference** of the devices, supplies, and prescriptions a person
with Type 1 Diabetes actually uses — so the app stops asking the user to type
what a barcode or product name already implies.

File: [`data/diabetes_catalog.csv`](../data/diabetes_catalog.csv)

## Why it's worth having

Once this CSV is real and reasonably complete, it unlocks several things cheaply:

- **Barcode → product.** The scanner already reads a GTIN ([`src/lib/gs1.ts`](../src/lib/gs1.ts)).
  With a `gtin` column here, a scan can **auto-fill the name, brand, and category**
  instead of asking the user to name it.
- **Smarter defaults.** `units_per_box`, `typical_usage_per_day`, and
  `default_refill_interval_days` let new supplies start with an honest *estimate*
  (clearly labelled as such), so runway and refill timing work on day one.
- **Categorization** for the dashboard and forecast, without guessing.
- **Less repeated work for the assistant.** Common product facts live in one
  reviewed file rather than being re-looked-up each session.

## CSV columns

| Column | Meaning |
|---|---|
| `category` | One of the app's categories: `patch_pump`, `cgm_sensor`, `infusion_set`, `insulin`, `bg_supply`, `glucagon`, `other`. |
| `brand` | Manufacturer (Insulet, Dexcom, Abbott, Tandem, Medtronic, Eli Lilly, Novo Nordisk…). |
| `product_name` | The canonical name shown in the app. |
| `common_names` | Other names/abbreviations users might type (pipe-separated). |
| `gtin` | Barcode number (GTIN-14). **Leave blank until verified** — never invent one. |
| `unit` | What one item is counted in (`pods`, `sensors`, `vials`, `sets`, `strips`). |
| `units_per_box` | Items in a typical box/refill. |
| `typical_usage_per_day` | Real device wear rate (e.g. a pod every 3 days = `0.33`). For insulin/strips it varies by person — leave blank or mark as a rough default. |
| `default_refill_interval_days` | Common dispensed supply length (often `30` or `90`). |
| `rx_required` | `yes` / `no`. |
| `notes` | Anything useful (e.g. "28-day in-use clock once opened"). |
| `source_url` | Where the fact came from. |
| `last_verified` | `YYYY-MM-DD` a human checked it. Blank = unverified. |

**Honesty rule (CLAUDE.md §9.1):** blank beats made-up. An empty `gtin` or
`last_verified` is fine; a fabricated one is not.

## What each "how long" number really is, and where it comes from

Four different facts the app wants, and they do **not** share a source:

| Fact | Per what | Only honest source |
|---|---|---|
| **Expiration date** | this exact box | the **box's barcode** (GS1 AI 17) or the pharmacy label. It is lot-specific, so no catalog or PDF can ever supply it — the scanner already reads it. |
| **Units per box** | the product | catalog `units_per_box`. |
| **How long each one lasts** (wear) | the product | catalog `typical_usage_per_day` (e.g. a 7-day sensor = `0.143`). |
| **In-use / once-opened life** | the product | catalog `notes` today (e.g. insulin "28-day in-use clock"); could become a structured `in_use_days` column when something consumes it. |

So three of the four are product properties that live here in the catalog; the
expiration is the only one that's inherently per-box and comes from the scan.

## The GTIN is the join key — and the real bottleneck

A scan gives a **GTIN**; the catalog turns that GTIN into everything above. If a
product's `gtin` cell is blank, a scan of that box can't be auto-identified.
**Today 56 of ~103 rows have no GTIN** (run `scripts/enrich_gtins.py`, then
`data/gtin_candidates.csv`), including big ones (Guardian 4, Omnipod 5, every
insulin).

Why we can't just bulk-fill them from the FDA: a 2026-06 run of the enrichment
script showed **openFDA/GUDID is unreliable for these consumables** —
"Dexcom G6 Sensor" returns the *transmitter/receiver*, "MiniMed Reservoir"
returns *pumps*, "Guardian 4" returns *orthopedic implants*, and insulins aren't
devices at all (they're drugs / NDC, not GTIN). Close brand, wrong product. Per
the honesty rule, a wrong GTIN is worse than a blank one, so those stay blank.

## How to contribute — the easy way (no spreadsheet)

The single most reliable GTIN for a product is the one **printed on the box you
actually own**. So the lowest-effort, highest-trust contribution is just to use
the app:

1. **Scan the boxes you use.** On the Add-a-supply screen, scan the barcode. If
   it's already in the catalog, everything fills in. If it isn't, tap
   **"Find it in the catalog"** and pick the product — *no typing*. The app saves
   the supply correctly **and** remembers the real scanned GTIN against it.
2. **Export and send.** Settings → *Export my data* produces a JSON that includes
   the `barcode` (GTIN) on each supply. Send me that file (or just the
   barcode↔product pairs). Each verified pair gets pasted into `gtin` here with a
   `source_url` of "scanned from box" and today's `last_verified`. After that, the
   product auto-matches forever, for you and everyone.

That's the whole contribution: scan, export, share. No reading PDFs, no filling a
spreadsheet from manuals.

### If you'd rather add a product that's missing entirely

Only needed for something not in the list at all. One row, these columns are
enough — leave anything you're unsure of blank (blank beats wrong):

```
category,brand,product_name,common_names,gtin,unit,units_per_box,typical_usage_per_day,notes
cgm_sensor,Medtronic,Guardian 4 Sensor,guardian 4|g4 sensor,<scan it>,sensors,5,0.143,7-day wear
```

`typical_usage_per_day` is just `1 ÷ (days each one lasts)` — a 7-day sensor is
`0.143`, a 3-day pod is `0.33`. That's the only "math" the catalog needs.

## Keeping it updated (future, not now)

This is a note for later, not a task to build yet:

- **Authoritative sources** for the verifiable fields: the FDA **openFDA** /
  **GUDID** device database (GTINs, device identifiers) and manufacturer product
  pages. Clinical wear-times come from each device's labeling.
- **A scheduled refresh** could live as a free **GitHub Actions cron** that pulls
  new/changed GTINs from GUDID into this CSV and opens a pull request for a human
  to review (never auto-merge medical data). The `last_verified` column is what
  keeps the bot honest — it only stamps a row a person actually approved.
- Until that exists, this file grows by hand, a few rows at a time. That's fine.
