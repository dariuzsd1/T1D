import Fuse from "fuse.js";
import { OCRExtractionResult } from "./ocrExtractor";
import { logger, PipelineError, withRetry } from "./telemetry";

export interface APIMatchCandidate {
    id: string;
    brand: string;
    name: string;
    category: string;
    confidenceScore: number; 
}

export interface APIMatcherResult {
    status: "AUTO_SUGGEST" | "REQUIRE_CONFIRMATION" | "FAILED";
    topMatches: APIMatchCandidate[];
    matchLogs: string[];
}

// Simple In-Memory Match Cache
const matchCache = new Map<string, APIMatcherResult>();

export const fdaDatabase = [
    { id: "1001", brand: "Insulet", name: "Omnipod Dash Pods", category: "patch_pump" },
    { id: "1002", brand: "Insulet", name: "Omnipod 5 Pods", category: "patch_pump" },
    { id: "1003", brand: "Dexcom", name: "G6 Sensor", category: "cgm_sensor" },
    { id: "1004", brand: "Dexcom", name: "G7 Sensor", category: "cgm_sensor" },
    { id: "1005", brand: "Eli Lilly", name: "Humalog (Insulin Lispro) U-100", category: "insulin" },
    { id: "1006", brand: "Sanofi", name: "Lantus (Insulin Glargine) SoloStar Pen", category: "insulin" },
    { id: "1007", brand: "Abbott", name: "FreeStyle Libre 3 Sensors", category: "cgm_sensor" },
    { id: "1008", brand: "Tandem", name: "AutoSoft 90 Infusion Set", category: "infusion_set" }
];

const fuseOptions = {
    includeScore: true,
    threshold: 0.6,
    keys: [
        { name: 'name', weight: 0.7 },
        { name: 'brand', weight: 0.3 }
    ]
};

const fuse = new Fuse(fdaDatabase, fuseOptions);

export async function executeAPIMatch(extractionData: OCRExtractionResult): Promise<APIMatcherResult> {
    const stage = "API_MATCHING";
    
    // Clean Query: Remove 'null' strings and trim
    let brand = extractionData.parsedData.brand || "";
    let product = extractionData.parsedData.product_name || "";
    if (product.toLowerCase() === "null") product = "";
    
    let query = `${brand} ${product}`.trim();
    
    // Check Cache
    if (matchCache.has(query)) {
        logger.log(stage, `Cache hit for: "${query}"`, "INFO");
        return matchCache.get(query)!;
    }

    logger.log(stage, `Starting match for: "${query}"`, "INFO");

    try {
        if (!query || query === "null") {
            throw new PipelineError(stage, "Incomplete search context.", false);
        }

        const result = await withRetry(async () => {
            if (Math.random() < 0.05) throw new Error("SIMULATED_NETWORK_FAILURE");

            let rawHits = fuse.search(query);
            
            // ── FALLBACK LOGIC ──────────────────────────────────────────
            // If specific search (Brand + Product) fails, fallback to Brand-Only
            if (rawHits.length === 0 && brand) {
                logger.log(stage, `Primary search failed. Falling back to Brand-Only search: "${brand}"`, "WARN");
                rawHits = fuse.search(brand);
            }

            if (rawHits.length === 0) {
                return { status: "FAILED", topMatches: [], matchLogs: ["No database hits."] } as APIMatcherResult;
            }

            const topMatches = rawHits.slice(0, 5).map(hit => ({
                id: hit.item.id,
                brand: hit.item.brand,
                name: hit.item.name,
                category: hit.item.category,
                confidenceScore: Number(( (1 - (hit.score ?? 1)) * 100).toFixed(1))
            }));

            const highestScore = topMatches[0].confidenceScore;
            // More lenient threshold for API matching specifically
            const status = highestScore > 80 ? "AUTO_SUGGEST" : "REQUIRE_CONFIRMATION";

            return {
                status,
                topMatches,
                matchLogs: [`Filtered ${topMatches.length} candidates. Top: ${highestScore}%`]
            } as APIMatcherResult;
        }, stage);

        matchCache.set(query, result);
        return result;

    } catch (err: any) {
        logger.log(stage, `API Matcher failure: ${err.message}`, "ERROR");
        return { status: "FAILED", topMatches: [], matchLogs: [err.message] };
    }
}


