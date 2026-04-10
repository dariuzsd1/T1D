import Fuse from "fuse.js";
import { OCRExtractionResult } from "./ocrExtractor";

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

// Simulated openFDA Subset Cache
export const fdaDatabase = [
    { id: "1001", brand: "Insulet", name: "Omnipod Dash Pods", category: "patch_pump" },
    { id: "1002", brand: "Insulet", name: "Omnipod 5 Pods", category: "patch_pump" },
    { id: "1003", brand: "Dexcom", name: "G6 Sensor", category: "cgm_sensor" },
    { id: "1004", brand: "Dexcom", name: "G7 Sensor", category: "cgm_sensor" },
    { id: "1005", brand: "Eli Lilly", name: "Humalog (Insulin Lispro) U-100", category: "insulin" },
    { id: "1006", brand: "Sanofi", name: "Lantus (Insulin Glargine) SoloStar Pen", category: "insulin" },
];

export function executeAPIMatch(extractionData: OCRExtractionResult): APIMatcherResult {
    let logs: string[] = [];
    
    // Fuse configuration mirroring our architecture limits
    const fuseOptions = {
        includeScore: true,
        threshold: 0.6, // strictness baseline
        keys: [
            { name: 'name', weight: 0.7 },
            { name: 'brand', weight: 0.3 }
        ]
    };

    const fuse = new Fuse(fdaDatabase, fuseOptions);

    if (extractionData.status === "FAILURE" || !extractionData.parsedData.brand) {
        logs.push("MATCH FAILED: Upstream OCR payload lacked sufficient entity data to search.");
        return { status: "FAILED", topMatches: [], matchLogs: logs };
    }

    // Attempt to match utilizing structured outputs
    const query = `${extractionData.parsedData.brand} ${extractionData.parsedData.product_name}`.trim();
    logs.push(`Initiating Fuse.js search query: "${query}"`);
    
    const rawHits = fuse.search(query);

    if (rawHits.length === 0) {
        logs.push(`MATCH FAILED: Could not resolve query > 60% confidence threshold against database.`);
        return { status: "FAILED", topMatches: [], matchLogs: logs };
    }

    // Top 3 filtering
    const topMatches = rawHits.slice(0, 3).map(hit => {
        const confMetric = Math.max(0, (1 - (hit.score ?? 1)) * 100);
        return {
            ...hit.item,
            confidenceScore: Number(confMetric.toFixed(1))
        };
    });

    const highestScore = topMatches[0].confidenceScore;
    
    let stateStatus: "AUTO_SUGGEST" | "REQUIRE_CONFIRMATION" = "REQUIRE_CONFIRMATION";
    
    if (highestScore > 85) {
        stateStatus = "AUTO_SUGGEST";
        logs.push(`SUCCESS: Match > 85% (${highestScore}%). UI set to Auto-Suggest.`);
    } else {
        logs.push(`LOW CONFIDENCE EVENT: Top match is ${highestScore}%. User Confirmation UI Prompts triggered.`);
    }

    return {
        status: stateStatus,
        topMatches,
        matchLogs: logs
    };
}
