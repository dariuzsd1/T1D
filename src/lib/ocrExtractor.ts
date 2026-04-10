import Fuse from "fuse.js";
import { logger, PipelineError } from "./telemetry";

export interface OCRExtractionResult {
    status: "SUCCESS" | "PARTIAL" | "FAILURE";
    raw_input: string;
    parsedData: {
        product_name: string | null;
        brand: string | null;
        product_category: string | null;
        quantity: number | null;
    };
    confidence: {
        total: number;
    };
    mismatchesLog: string[]; 
}

const BRAND_REFERENCE = [
    { brand: "Insulet", category: "patch_pump", aliases: ["omnipod", "insulet", "dash", "pod", "ominpo", "omn1pod", "bash", "pds", "pod5", "pods"] },
    { brand: "Dexcom", category: "cgm_sensor", aliases: ["dexcom", "d&xcam", "sensors", "g6", "g7", "gf", "d x c o m", "dxcom", "xcm", "dxc", "xcmg"] },
    { brand: "Eli Lilly", category: "insulin", aliases: ["humalog", "lispro", "lilly", "humal0g", "h m a l o g", "humlog", "eli lilly"] },
    { brand: "Sanofi", category: "insulin", aliases: ["lantus", "glargine", "sanofi", "solostar", "lntus"] },
    { brand: "Abbott", category: "cgm_sensor", aliases: ["freestyle", "libre", "abbott", "fresstyle"] },
    { brand: "Tandem", category: "infusion_set", aliases: ["tandem", "t:slim", "autosoft", "infusion", "t slim"] }
];

const UNIT_REFERENCE = [
    { unit: "pack", aliases: ["pack", "packs", "count", "ea", "pcs", "items", "ct", "vials", "pens", "contains", "includes", "units"] },
    { unit: "pod", aliases: ["pod", "pods", "dash"] },
    { unit: "sensor", aliases: ["sensor", "sensors"] },
    { unit: "vial", aliases: ["vial", "vials"] },
    { unit: "pen", aliases: ["pen", "pens"] }
];

const fuseOptions = {
    includeScore: true,
    threshold: 0.4, 
    minMatchCharLength: 2,
    keys: ["aliases"]
};

const brandFuse = new Fuse(BRAND_REFERENCE, fuseOptions);
const unitFuse = new Fuse(UNIT_REFERENCE, fuseOptions);

export function extractEntities(rawText: string): OCRExtractionResult {
    const stage = "ENTITY_EXTRACTION";

    try {
        let txt = rawText?.toLowerCase() || "";
        
        // ── PRE-PROCESSOR: Join single-character sequences (e.g., "D e x c o m" -> "Dexcom")
        txt = txt.replace(/(?:^|\s)([a-z0-9])(?:\s+([a-z0-9]))+(?:\s|$)/gi, (match) => {
            return match.replace(/\s+/g, "");
        });

        // Final sanitation
        txt = txt.replace(/[^a-z0-9\s]/g, " ");
        const words = txt.split(/\s+/).filter(w => w.length >= 1);
        
        const result: OCRExtractionResult = {
            status: "FAILURE",
            raw_input: rawText,
            parsedData: { product_name: null, brand: null, product_category: null, quantity: null },
            confidence: { total: 0 },
            mismatchesLog: []
        };

        if (txt.trim() === "") return result;

        // ── 1. N-GRAM AGGRESSIVE SEARCH ───────────────────────────────────
        let bestBrand: any = null;
        let bestScore = 1.0;

        for (let size = 1; size <= 3; size++) {
            for (let i = 0; i <= words.length - size; i++) {
                const nGram = words.slice(i, i + size).join(" ");
                const hits = brandFuse.search(nGram);
                if (hits.length > 0 && hits[0].score! < bestScore) {
                    bestScore = hits[0].score!;
                    bestBrand = hits[0].item;
                }
            }
        }

        if (bestBrand) {
            result.parsedData.brand = bestBrand.brand;
            result.parsedData.product_category = bestBrand.category;

            if (bestBrand.brand === "Insulet") {
                result.parsedData.product_name = txt.includes("5") ? "Omnipod 5 Pods" : "Omnipod Dash Pods";
            } else if (bestBrand.brand === "Dexcom") {
                result.parsedData.product_name = txt.includes("g7") ? "G7 Sensor" : "G6 Sensor";
            } else if (bestBrand.brand === "Eli Lilly") {
                result.parsedData.product_name = "Humalog (Insulin Lispro)";
            } else {
                result.parsedData.product_name = bestBrand.brand;
            }
        }

        // ── 2. QUANTITY SEARCH ──────────────────────────────────────────
        const numbers = txt.match(/\d+/g);
        if (numbers) {
            for (const numStr of numbers) {
                const num = parseInt(numStr);
                if (num <= 0 || num > 500) continue;

                const pos = txt.indexOf(numStr);
                const window = txt.substring(Math.max(0, pos - 20), Math.min(txt.length, pos + 25));
                const unitHits = unitFuse.search(window);
                
                if (unitHits.length > 0) {
                    result.parsedData.quantity = num;
                    break;
                }
            }
        }

        // ── 3. FINAL CONFIDENCE ───────────────────────────────────────────
        if (result.parsedData.brand && result.parsedData.quantity) {
            result.status = "SUCCESS";
            result.confidence.total = Math.max(90, Math.round((1.1 - bestScore) * 100)); 
        } else if (result.parsedData.brand) {
            result.status = "PARTIAL";
            result.confidence.total = Math.max(70, Math.round((1.1 - bestScore) * 80));
        }

        logger.log(stage, `Fuzzy Result: ${result.status} (Conf: ${result.confidence.total}%)`, "INFO");
        return result;

    } catch (err: any) {
        logger.log(stage, `Extraction crash: ${err.message}`, "ERROR");
        return { 
            status: "FAILURE", 
            raw_input: rawText, 
            parsedData: { product_name: null, brand: null, product_category: null, quantity: null }, 
            confidence: { total: 0 }, 
            mismatchesLog: [err.message] 
        };
    }
}
