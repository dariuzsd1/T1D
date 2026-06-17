# Barcode scanning

The **Add a supply** page can scan the barcode on a box or pharmacy label using
your device's camera. It needs **no app install and no npm dependency** — it uses
the browser's built-in [Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API).

## What it does

1. Opens your rear camera and looks for a barcode (UPC/EAN, Code 128, GS1
   DataMatrix, QR, and more).
2. Decodes it and, if the label is a **GS1** barcode (most pharmacy/medical
   labels are), reads the structured fields out of it:
   - **GTIN** — the product number (stored for future reorder matching).
   - **Expiration date** — auto-filled into the form (you'll see "Read from the
     barcode"). Nothing is guessed — if the code doesn't carry a date, the field
     stays empty.
   - **Lot number** — captured for reference.
3. You confirm the product **name** (we don't have a product directory to look a
   GTIN up yet, so you name it once) and tap **Add to inventory**.

The GS1 parsing logic lives in [`src/lib/gs1.ts`](../src/lib/gs1.ts) and is pure,
dependency-free, and honest: it only surfaces a field it actually decoded.

## Browser support

| Browser | Camera scan? |
|---|---|
| Chrome (Android & desktop) | ✅ Yes |
| Safari (iOS & macOS) | ✅ Yes (recent versions) |
| Firefox | ❌ Not yet — falls back to manual entry |

When the API isn't available, or camera permission is denied, the scanner shows a
clear message and a **"Enter manually instead"** button — it's never a dead end.
Scanning also requires **HTTPS** (your deployed site) or `localhost`; cameras are
blocked on plain `http://`.

## Optional: store the GTIN + lot (1-minute migration)

The scan works without this. But if you add two columns, the app will also save
the scanned **GTIN** and **lot number** on each supply — useful later for reorder
matching and recall checks. The code already writes them *best-effort*: before you
run this, it just skips saving them (a one-line console note), and the core supply
still saves fine.

Supabase dashboard → **SQL Editor** → **+ New query** → run:

```sql
alter table public.supplies
  add column if not exists barcode    text,
  add column if not exists lot_number text;
```

These columns are nullable and inherit the `supplies` table's existing
Row-Level Security — no extra policy needed.

## Notes / next steps

- **No GTIN→product directory yet.** That's why you name the product after
  scanning. A future step is a lookup table (or a vendor API) so a known GTIN
  auto-fills the name and brand — the read path is already capturing the GTIN to
  make that possible.
- **The photo path is still a mock.** The "add a photo instead" flow uses the
  older placeholder matcher (always returns the same item); barcode scanning is
  the real, trustworthy path. Replacing or removing the photo mock is tracked
  separately in CLAUDE.md.
