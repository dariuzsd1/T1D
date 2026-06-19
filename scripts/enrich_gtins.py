#!/usr/bin/env python3
"""
enrich_gtins.py — stage REAL device identifiers from BOTH the US and EU
regulatory databases for human review. Covers two continents.

WHY THIS EXISTS
---------------
The product catalog (data/diabetes_catalog.csv) ships with empty `gtin` cells on
purpose. An identifier (barcode/UDI-DI) must be VERIFIED, never guessed — a wrong
code in a medical app is worse than a blank one. This script does NOT write codes
into the catalog. It queries the official sources, finds candidate matches, and
writes them to data/gtin_candidates.csv for a HUMAN to review and approve. You
copy the correct code into the catalog yourself and stamp `last_verified`. That
keeps the honesty rule intact: blank beats made-up.

THE TWO SOURCES
---------------
US — openFDA Device UDI API   https://api.fda.gov/device/udi.json
     (FDA Global Unique Device Identification Database / GUDID). Public, no key
     needed; a free key raises rate limits (https://open.fda.gov/apis/authentication/).

EU — EUDAMED public API       https://ec.europa.eu/tools/eudamed/api/devices/udiDiData
     (European Database on Medical Devices). Public, no key. Note: EUDAMED only
     became mandatory on 28 May 2026, so coverage is still filling in, and the
     public API is unofficial/undocumented — it can be slow and occasionally
     flaky. Treat EU misses as "not in EUDAMED yet," not as an error.

THE CROSS-CONTINENT TRICK
-------------------------
GS1 GTINs are used as the device identifier (DI) in BOTH systems. So once the US
lookup finds a Primary DI (a GTIN), we can look that SAME number up directly in
EUDAMED via the documented ?primaryDi= filter. This gives EU registration data
(trade name, manufacturer, SRN, risk class) with zero guessing. EU enrichment
therefore piggybacks on US discovery.

For EU-only devices that GUDID won't have (e.g. YpsoPump, Roche Solo, Dana),
fill in EU_SRN_BY_BRAND below with the manufacturer's EUDAMED SRN (look it up
once at the EUDAMED actor search) and the script will pull that maker's
on-market EU devices and match by trade name.

USAGE
-----
    python3 scripts/enrich_gtins.py                  # US + EU
    python3 scripts/enrich_gtins.py --us-only        # skip EUDAMED
    python3 scripts/enrich_gtins.py --eu-only        # skip openFDA
    python3 scripts/enrich_gtins.py --api-key KEY    # higher openFDA rate limit
    OPENFDA_API_KEY=KEY python3 scripts/enrich_gtins.py

Then open data/gtin_candidates.csv, pick the right row per product (the `source`
column tells you US vs EU), paste its code into data/diabetes_catalog.csv, and
set source_url + last_verified yourself. Never auto-merge.

Standard library only — no pip installs.
"""

import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

CATALOG = "data/diabetes_catalog.csv"
CANDIDATES = "data/gtin_candidates.csv"
TODAY = date.today().isoformat()

OPENFDA_BASE = "https://api.fda.gov/device/udi.json"
EUDAMED_BASE = "https://ec.europa.eu/tools/eudamed/api/devices/udiDiData"

# Insulin and generic pharmacy/food items are drugs (NDC) or not registered as
# devices — the device databases won't have them. Skip them for device lookups;
# their identifiers come from drug directories (US NDC / EU EMA) instead.
SKIP_CATEGORIES = {"insulin", "hypo_treatment"}

# OPTIONAL: EU-only manufacturers whose devices may not appear in US GUDID.
# Find an SRN once via the EUDAMED actor search (https://ec.europa.eu/tools/eudamed),
# then paste it here. Leave blank to skip — never invent an SRN.
#   "Ypsomed": "CH-MF-000000000",
#   "Roche": "DE-MF-000000000",
EU_SRN_BY_BRAND = {
    # "Brand as in catalog": "EU-SRN",
}

ON_MARKET = "refdata.device-model-status.on-the-market"


# ----------------------------- shared helpers ------------------------------ #

def get_flag(name):
    return name in sys.argv


def get_api_key():
    for i, a in enumerate(sys.argv):
        if a == "--api-key" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return os.environ.get("OPENFDA_API_KEY", "")


API_KEY = get_api_key()


def http_get_json(url, timeout=40):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "t1d-supply-hub-catalog/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp), None
    except urllib.error.HTTPError as e:
        # Both APIs return 404 for "no matching records" — that's normal, not an error.
        if e.code == 404:
            return None, "no-results"
        return None, f"http-{e.code}"
    except Exception as e:  # noqa: BLE001
        return None, str(e)


def keyword_from(name):
    """Pick the model word most likely printed on the label (e.g. 'G7', 'Verio')."""
    words = [w for w in name.replace("(", " ").replace(")", " ").split()
             if w.lower() not in {"insulin", "the", "and", "test", "sensor", "set"}]
    return words[-1] if words else ""


# ------------------------------ US: openFDA -------------------------------- #

def openfda_query(search, limit=10):
    params = {"search": search, "limit": str(limit)}
    if API_KEY:
        params["api_key"] = API_KEY
    url = OPENFDA_BASE + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    data, err = http_get_json(url)
    if err or not data:
        return [], url
    return data.get("results", []), url


def openfda_primary_di(result):
    for ident in result.get("identifiers", []):
        if ident.get("type") == "Primary":
            return ident.get("id", ""), ident.get("issuing_agency", "")
    ids = result.get("identifiers", [])
    if ids:
        return ids[0].get("id", ""), ids[0].get("issuing_agency", "")
    return "", ""


def collect_us(row):
    """Return (candidate_rows, primary_dis_found) for one catalog row via openFDA."""
    brand, name = row["brand"].strip(), row["product_name"].strip()

    # Strip noise words to get the product model keywords (e.g. "Dexcom G7" from
    # "Dexcom G7 Sensor", "OmniPod 5" from "Omnipod 5 Pod").
    _noise = {'the', 'and', 'for', 'with', 'set', 'kit', 'pack', 'plus', 'ultra',
              'test', 'sensor', 'sensors', 'device', 'system', 'universal', 'classic',
              'blood', 'glucose', 'urine', 'nasal', 'ketone', 'lancing', 'lancets',
              'insulin', 'infusion', 'needles', 'strips', 'strip', 'meter', 'smart',
              'transmitter', 'cartridge', 'reservoir', 'syringe', 'syringes', 'pod',
              'pods', 'pen', 'pens', 'wipes', 'pads', 'patches', 'solution',
              'control', 'disposal', 'container', 'advance', 'extended', 'precision',
              'bionic', 'pancreas', 'mylife'}
    sig = [w for w in name.replace('(', '').replace(')', '').replace('/', ' ').split()
           if len(w) > 1 and w.lower() not in _noise]

    kw = keyword_from(name)
    queries = []
    # Most specific: search for the product model keywords in brand_name (in openFDA,
    # brand_name is the specific product line, e.g. "Dexcom G7", "OmniPod DASH").
    if len(sig) >= 2:
        queries.append(f'brand_name:"{" ".join(sig[:3])}"')
        queries.append(f'brand_name:"{" ".join(sig[:2])}"')
    if sig:
        queries.append(f'brand_name:"{sig[0]}"')
    # Keyword in device_description (catches products where brand_name differs)
    if kw and len(kw) > 2:
        queries.append(f'device_description:"{kw}"')
    # Last resort: broad company name (usually too noisy, but catches stragglers)
    if brand:
        queries.append(f'company_name:"{brand}"')

    results, used_url = [], ""
    for q in queries:
        results, used_url = openfda_query(q, limit=10)
        time.sleep(0.3)
        if results:
            break

    out, dis = [], []
    for res in results:
        gtin, agency = openfda_primary_di(res)
        if not gtin:
            continue
        dis.append(gtin)
        out.append({
            "source": "openFDA-US",
            "catalog_product_name": name,
            "catalog_brand": brand,
            "candidate_code": gtin,
            "issuing_agency": agency,
            "name_in_db": res.get("brand_name", ""),
            "company_in_db": res.get("company_name", ""),
            "detail_or_class": res.get("device_description", ""),
            "extra_id": res.get("version_or_model_number", ""),
            "manufacturer_srn": "",
            "status": res.get("commercial_distribution_status", ""),
            "detail_uuid": "",
            "query_url": used_url,
            "found_on": TODAY,
        })
    return out, dis


# ------------------------------- EU: EUDAMED ------------------------------- #

def eudamed_url(**params):
    base_params = {"page": "1", "pageSize": "25", "size": "25",
                   "iso2Code": "en", "languageIso2Code": "en"}
    base_params.update({k: str(v) for k, v in params.items()})
    return EUDAMED_BASE + "?" + urllib.parse.urlencode(base_params, quote_via=urllib.parse.quote)


def _code(d, *path):
    """Safely pull a nested {'code': ...} value."""
    cur = d
    for p in path:
        if not isinstance(cur, dict):
            return ""
        cur = cur.get(p)
    return cur or ""


def eudamed_entry_to_row(entry, name, brand, used_url):
    return {
        "source": "EUDAMED-EU",
        "catalog_product_name": name,
        "catalog_brand": brand,
        "candidate_code": entry.get("primaryDi", "") or "",
        "issuing_agency": "EU-UDI",
        "name_in_db": entry.get("tradeName", "") or "",
        "company_in_db": entry.get("manufacturerName", "") or "",
        "detail_or_class": _code(entry, "riskClass", "code"),
        "extra_id": entry.get("basicUdi", "") or "",
        "manufacturer_srn": entry.get("manufacturerSrn", "") or "",
        "status": _code(entry, "deviceStatusType", "code"),
        "detail_uuid": entry.get("uuid", "") or "",
        "query_url": used_url,
        "found_on": TODAY,
    }


def eudamed_by_di(di, name, brand):
    """Look up a known DI (GTIN) directly in EUDAMED — the documented, reliable path."""
    url = eudamed_url(primaryDi=di)
    data, err = http_get_json(url)
    time.sleep(0.6)  # EUDAMED is slow; be gentle
    if err or not data:
        return []
    return [eudamed_entry_to_row(e, name, brand, url) for e in data.get("content", [])]


def eudamed_by_srn(srn, name, brand, max_pages=8):
    """Pull a manufacturer's on-market EU devices and filter by trade name client-side."""
    matched, kw = [], keyword_from(name).lower()
    brand_l = brand.lower()
    for page in range(1, max_pages + 1):
        url = eudamed_url(page=page, pageSize=100, size=100,
                          srn=srn, deviceStatusCode=ON_MARKET,
                          sort="primaryDi,ASC")
        data, err = http_get_json(url)
        time.sleep(0.6)
        if err or not data:
            break
        content = data.get("content", [])
        for e in content:
            tn = (e.get("tradeName") or "").lower()
            if (kw and kw in tn) or (brand_l and brand_l in tn):
                matched.append(eudamed_entry_to_row(e, name, brand, url))
        if data.get("last", True):
            break
    return matched


# --------------------------------- main ------------------------------------ #

def main():
    if not os.path.exists(CATALOG):
        sys.exit(f"Cannot find {CATALOG}. Run from the repo root.")

    do_us = not get_flag("--eu-only")
    do_eu = not get_flag("--us-only")

    with open(CATALOG, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    out = []
    seen = set()  # dedupe (source, product_name, code)

    def add(rec):
        key = (rec["source"], rec["catalog_product_name"], rec["candidate_code"])
        if rec["candidate_code"] and key not in seen:
            seen.add(key)
            out.append(rec)

    for row in rows:
        if row["category"] in SKIP_CATEGORIES or row.get("gtin"):
            continue
        name, brand = row["product_name"], row["brand"]
        print(f"Looking up: {name}")

        us_dis = []
        if do_us:
            us_rows, us_dis = collect_us(row)
            for r in us_rows:
                add(r)
            print(f"  US (openFDA): {len(us_rows)} candidate(s)")

        if do_eu:
            eu_rows = []
            # 1) reliable: cross-reference each US GTIN directly in EUDAMED
            for di in us_dis[:5]:  # cap to avoid hammering the slow EU API
                eu_rows += eudamed_by_di(di, name, brand)
            # 2) EU-only fallback: by manufacturer SRN, if one is configured
            srn = EU_SRN_BY_BRAND.get(brand)
            if srn:
                eu_rows += eudamed_by_srn(srn, name, brand)
            for r in eu_rows:
                add(r)
            print(f"  EU (EUDAMED): {len(eu_rows)} candidate(s)")

    fields = ["source", "catalog_product_name", "catalog_brand", "candidate_code",
              "issuing_agency", "name_in_db", "company_in_db", "detail_or_class",
              "extra_id", "manufacturer_srn", "status", "detail_uuid",
              "query_url", "found_on"]
    with open(CANDIDATES, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(out)

    us_n = sum(1 for r in out if r["source"] == "openFDA-US")
    eu_n = sum(1 for r in out if r["source"] == "EUDAMED-EU")
    print(f"\nWrote {len(out)} candidate rows to {CANDIDATES}  (US: {us_n}, EU: {eu_n})")
    print("REVIEW each candidate, confirm the name/company match your product,")
    print("then paste the correct code into the catalog and set source_url +")
    print("last_verified yourself. Never auto-merge medical data.")


if __name__ == "__main__":
    main()
