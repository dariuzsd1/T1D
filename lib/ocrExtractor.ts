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
    mismatchesLog: string[]; // Logs reasons for mismatches or missing data
}

/**
 * Extracts structured medical data from a raw, garbled OCR string.
 * Employs strict Regex bounding to prevent parsing breaks.
 */
export function extractEntities(rawText: string): OCRExtractionResult {
    const txt = rawText.toLowerCase();
    let mismatches: string[] = [];
    
    // Default Schema
    const result: OCRExtractionResult = {
        status: "FAILURE",
        raw_input: rawText,
        parsedData: {
            product_name: null,
            brand: null,
            product_category: null,
            quantity: null,
        },
        confidence: { total: 10 },
        mismatchesLog: []
    };

    if (!txt || txt.trim() === "") {
        result.mismatchesLog.push("CRITICAL FAILURE: OCR generated empty text string.");
        return result;
    }

    // 1. BRAND & CATEGORY EXTRACTION
    if (txt.includes("omnipod") || txt.includes("ominpo") || txt.includes("insulet")) {
        result.parsedData.brand = "Insulet";
        result.parsedData.product_category = "patch_pump";
        if (txt.includes("dash")) result.parsedData.product_name = "Omnipod Dash Pods";
        else if (txt.includes("5")) result.parsedData.product_name = "Omnipod 5 Pods";
        else result.parsedData.product_name = "Omnipod Pods (Unknown Gen)";
    } 
    else if (txt.includes("dexcom") || txt.includes("d&xcam")) {
        result.parsedData.brand = "Dexcom";
        if (txt.includes("g7")) { result.parsedData.product_name = "G7 Sensor"; result.parsedData.product_category = "cgm_sensor"; }
        else if (txt.includes("g6") || txt.includes("gf")) { result.parsedData.product_name = "G6 Sensor"; result.parsedData.product_category = "cgm_sensor"; }
    }
    else if (txt.includes("humalog") || txt.includes("lispro")) {
        result.parsedData.brand = "Eli Lilly";
        result.parsedData.product_name = "Humalog (Insulin Lispro)";
        result.parsedData.product_category = txt.includes("pen") ? "insulin_pen" : "insulin_vial";
    }
    else if (txt.includes("lantus") || txt.includes("glargine")) {
        result.parsedData.brand = "Sanofi";
        result.parsedData.product_name = "Lantus (Insulin Glargine)";
        result.parsedData.product_category = txt.includes("pen") ? "insulin_pen" : "insulin_vial";
    }
    else if (txt.includes("autosoft") || txt.includes("tandem")) {
        result.parsedData.brand = "Tandem";
        result.parsedData.product_name = "AutoSoft Infusion Set";
        result.parsedData.product_category = "infusion_set";
    }

    // Missing Brand Check
    if (!result.parsedData.brand) {
        mismatches.push("MISMATCH: Could not map OCR text to a known T1D medical brand.");
    }

    // 2. QUANTITY EXTRACTION
    // Looks for explicit box counts (e.g. "5 pack", "10ea", "contains 5", "5x")
    const qtyRegexes = [
        /(\d+)\s*(?:pack|packs|count|ea|pcs|sets|pods|sensors)/,
        /(?:contains|includes)\s*(\d+)/,
        /(\d+)x/
    ];

    for (let reg of qtyRegexes) {
        const match = txt.match(reg);
        if (match && match[1]) {
            result.parsedData.quantity = parseInt(match[1]);
            break;
        }
    }

    // Missing Quantity Check
    if (result.parsedData.quantity === null) {
        mismatches.push("WARNING: Missing Quantity. Required field omitted due to OCR rip/fade.");
    }

    // 3. CONFIDENCE & STATUS SCORING
    result.mismatchesLog = mismatches;

    if (result.parsedData.brand && result.parsedData.quantity) {
        result.status = "SUCCESS";
        result.confidence.total = 95; // High logic certainty
    } else if (result.parsedData.brand && !result.parsedData.quantity) {
        result.status = "PARTIAL";
        result.confidence.total = 65; // Good hit, missing vital info
    } else {
        result.status = "FAILURE";
        result.confidence.total = 10;
    }

    return result;
}
