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
