/**
 * src/lib/pipeline.ts
 * The production-grade orchestration layer for the T1D Supply Scanner.
 * Chains: OCR → Entity Extraction → API Match → Confidence → Duration
 */

import { extractEntities, OCRExtractionResult } from "./ocrExtractor";
import { executeAPIMatch, APIMatcherResult } from "./apiMatcher";
import { estimateDuration, DurationResult, UserProfile } from "./durationEstimator";
import { logger, PipelineError } from "./telemetry";

export interface PipelineOutput {
    status: "AUTO_SUGGEST" | "REQUIRE_CONFIRMATION" | "FAILED" | "ERROR";
    ui_routing: "CONFIRMATION_SCREEN" | "MANUAL_ENTRY" | "AUTO_DISPATCH";
    extraction: OCRExtractionResult;
    api_match: APIMatcherResult;
    duration: DurationResult | null;
    confidence_metrics: {
        ocr_hardware: number;
        extraction: number;
        api: number;
        aggregated: number;
    };
    debug_logs: any[];
}

/**
 * Integrated Master Pipeline
 * Orchestrates all stages with full async support and telemetry.
 */
export async function runPipeline(
    rawText: string, 
    ocrHardwareScore: number,
    profile: UserProfile = {}
): Promise<PipelineOutput> {
    const stage = "MASTER_PIPELINE";
    logger.log(stage, "Initiating global pipeline", "INFO");

    try {
        // Stage 1: Extraction
        const extraction = extractEntities(rawText);

        // Stage 2: API Match (Async)
        const apiMatch = await executeAPIMatch(extraction);

        // Stage 3: Aggregated Confidence Scoring
        const extractionWeight = 0.2;
        const apiWeight = 0.6;
        const ocrWeight = 0.2;

        const apiScore = apiMatch.topMatches[0]?.confidenceScore ?? 0;
        
        const aggregatedConfidence = Math.min(100,
            (ocrHardwareScore * ocrWeight) + 
            (extraction.confidence.total * extractionWeight) + 
            (apiScore * apiWeight)
        );

        // Stage 4: Duration Estimation
        let duration: DurationResult | null = null;
        if (apiMatch.topMatches.length > 0) {
            duration = estimateDuration(apiMatch.topMatches[0], extraction, profile);
        }

        // Logic routing based on reliability
        let status: PipelineOutput["status"] = apiMatch.status === "FAILED" ? "FAILED" : (apiMatch.status as any);
        let routing: PipelineOutput["ui_routing"] = "CONFIRMATION_SCREEN";

        if (aggregatedConfidence < 40) {
            status = "FAILED";
            routing = "MANUAL_ENTRY";
        } else if (aggregatedConfidence >= 85) {
            status = "AUTO_SUGGEST";
            routing = "AUTO_DISPATCH";
        }

        const output: PipelineOutput = {
            status: status as any,
            ui_routing: routing,
            extraction,
            api_match: apiMatch,
            duration,
            confidence_metrics: {
                ocr_hardware: ocrHardwareScore,
                extraction: extraction.confidence.total,
                api: apiScore,
                aggregated: Number(aggregatedConfidence.toFixed(1))
            },
            debug_logs: logger.getLogs()
        };

        logger.log(stage, `Pipeline finalized: ${status}`, "INFO", { aggregatedConfidence });
        return output;

    } catch (err: any) {
        logger.log(stage, `Pipeline fatal crash: ${err.message}`, "ERROR");
        return {
            status: "ERROR",
            ui_routing: "MANUAL_ENTRY",
            extraction: { status: "FAILURE", raw_input: rawText, parsedData: { brand: null, product_name: null, product_category: null, quantity: null }, confidence: { total: 0 }, mismatchesLog: [err.message] },
            api_match: { status: "FAILED", topMatches: [], matchLogs: [err.message] },
            duration: null,
            confidence_metrics: { ocr_hardware: 0, extraction: 0, api: 0, aggregated: 0 },
            debug_logs: logger.getLogs()
        };
    }
}
