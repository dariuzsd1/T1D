/**
 * pipeline.ts
 * The full orchestration layer for the T1D Supply Scanner.
 * Chains: OCR → Entity Extraction → API Match → Confidence → Duration
 * Returns a single, complete JSON payload for the frontend to consume.
 */

import { extractEntities, OCRExtractionResult } from "./ocrExtractor";
import { executeAPIMatch, APIMatcherResult } from "./apiMatcher";
import { estimateDuration, UserProfile, DurationResult } from "./durationEstimator";

// ── Output Schema ─────────────────────────────────────────────────────────────
export interface PipelineOutput {
    pipeline_version: string;
    timestamp: string;
    status: "AUTO_SUGGEST" | "REQUIRE_CONFIRMATION" | "FAILED" | "ERROR";
    ui_action: string;

    confidence: {
        ocr_score: number;
        extraction_score: number;
        api_match_score: number;
        overall_score: number;
        breakdown: string;
    };

    ocr: {
        raw_text: string;
    };

    extraction: {
        status: OCRExtractionResult["status"];
        parsed: OCRExtractionResult["parsedData"];
        mismatches: string[];
    };

    api_match: {
        status: APIMatcherResult["status"];
        top_matches: APIMatcherResult["topMatches"];
        logs: string[];
    };

    duration: DurationResult | null;

    debug_log: string[];
    fatal_error: string | null;
}

// ── Master Weights (from confidence_scoring_system design doc) ────────────────
const W_OCR = 0.20;
const W_EXTRACT = 0.30;
const W_API = 0.50;

// ── The Pipeline Orchestrator ─────────────────────────────────────────────────
export function runPipeline(
    rawOcrText: string,
    ocrHardwareScore: number,       // Passed in from Tesseract/Google Vision
    userProfile: UserProfile
): PipelineOutput {

    const debugLog: string[] = [];
    const timestamp = new Date().toISOString();

    const baseOutput: PipelineOutput = {
        pipeline_version: "1.0.0",
        timestamp,
        status: "FAILED",
        ui_action: "Redirect to Manual Entry",
        confidence: { ocr_score: 0, extraction_score: 0, api_match_score: 0, overall_score: 0, breakdown: "" },
        ocr: { raw_text: rawOcrText },
        extraction: { status: "FAILURE", parsed: { product_name: null, brand: null, product_category: null, quantity: null }, mismatches: [] },
        api_match: { status: "FAILED", top_matches: [], logs: [] },
        duration: null,
        debug_log: [],
        fatal_error: null,
    };

    try {
        // ── STAGE 1: Validate OCR Input ───────────────────────────────────────
        debugLog.push(`[STAGE 1] OCR Hardware Score received: ${ocrHardwareScore}%`);
        if (!rawOcrText || rawOcrText.trim().length < 3) {
            throw new Error("OCR stage returned empty or unusable text. Pipeline aborted.");
        }
        baseOutput.ocr.raw_text = rawOcrText;
        debugLog.push(`[STAGE 1] Raw text validated. Length: ${rawOcrText.length} chars.`);

        // ── STAGE 2: Entity Extraction ────────────────────────────────────────
        debugLog.push(`[STAGE 2] Running entity extraction...`);
        const extraction = extractEntities(rawOcrText);
        baseOutput.extraction = {
            status: extraction.status,
            parsed: extraction.parsedData,
            mismatches: extraction.mismatchesLog,
        };

        const extractionScore = extraction.confidence.total;
        debugLog.push(`[STAGE 2] Extraction complete. Status: ${extraction.status} | Score: ${extractionScore}%`);
        if (extraction.mismatchesLog.length > 0) {
            extraction.mismatchesLog.forEach(m => debugLog.push(`[STAGE 2] ⚠️  ${m}`));
        }

        // ── STAGE 3: API Matching ─────────────────────────────────────────────
        debugLog.push(`[STAGE 3] Querying simulated openFDA database...`);
        const matchResult = executeAPIMatch(extraction);
        baseOutput.api_match = {
            status: matchResult.status,
            top_matches: matchResult.topMatches,
            logs: matchResult.matchLogs,
        };
        matchResult.matchLogs.forEach(l => debugLog.push(`[STAGE 3] ${l}`));

        const apiMatchScore = matchResult.topMatches.length > 0
            ? matchResult.topMatches[0].confidenceScore
            : 0;

        // ── STAGE 4: Confidence Aggregation ──────────────────────────────────
        debugLog.push(`[STAGE 4] Computing weighted confidence score...`);
        const overallScore = (ocrHardwareScore * W_OCR) + (extractionScore * W_EXTRACT) + (apiMatchScore * W_API);
        const breakdown = `(${ocrHardwareScore} * ${W_OCR}) + (${extractionScore} * ${W_EXTRACT}) + (${apiMatchScore} * ${W_API}) = ${overallScore.toFixed(1)}`;
        baseOutput.confidence = {
            ocr_score: ocrHardwareScore,
            extraction_score: extractionScore,
            api_match_score: apiMatchScore,
            overall_score: Number(overallScore.toFixed(1)),
            breakdown,
        };
        debugLog.push(`[STAGE 4] Overall Score: ${overallScore.toFixed(1)}% | Formula: ${breakdown}`);

        // ── STAGE 5: Route by Confidence Threshold ────────────────────────────
        if (matchResult.status === "FAILED" || overallScore < 60) {
            baseOutput.status = "FAILED";
            baseOutput.ui_action = "Show manual entry form. AI cannot determine product.";
            debugLog.push(`[STAGE 5] Score < 60%. Status: FAILED. Routing to manual entry.`);
        } else {
            const topMatch = matchResult.topMatches[0];

            // ── STAGE 6: Duration Estimation ─────────────────────────────────
            debugLog.push(`[STAGE 6] Running duration estimation for: ${topMatch.name}`);
            const duration = estimateDuration(topMatch, extraction, userProfile);
            baseOutput.duration = duration;

            if (duration.missing_variables_prompt) {
                debugLog.push(`[STAGE 6] ⚠️  Missing variable: Prompt dispatched to frontend.`);
            } else {
                debugLog.push(`[STAGE 6] ✅ Duration: ${duration.estimated_duration_days} days | Refill: ${duration.refill_date}`);
            }

            // Set final UI status
            if (overallScore > 85) {
                baseOutput.status = "AUTO_SUGGEST";
                baseOutput.ui_action = "Pre-fill form. Show confirmation button only.";
            } else {
                baseOutput.status = "REQUIRE_CONFIRMATION";
                baseOutput.ui_action = "Show top 3 candidates. Force user to select product.";
            }
            debugLog.push(`[STAGE 5] UI Action: ${baseOutput.ui_action}`);
        }

    } catch (err: any) {
        const errMsg = err?.message ?? "Unknown pipeline error";
        debugLog.push(`[FATAL ERROR] ${errMsg}`);
        baseOutput.fatal_error = errMsg;
        baseOutput.status = "ERROR";
        baseOutput.ui_action = "Show error toast. Return to scanner.";
    }

    baseOutput.debug_log = debugLog;
    return baseOutput;
}
