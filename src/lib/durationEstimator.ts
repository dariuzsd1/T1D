import { APIMatchCandidate } from "./apiMatcher";
import { OCRExtractionResult } from "./ocrExtractor";
import { logger, PipelineError } from "./telemetry";

export interface UserProfile {
    average_daily_basal?: number;   
    average_daily_bolus?: number;   
    frequency_overrides?: Record<string, number>; 
}

export interface DurationResult {
    estimated_duration_days: number | null;
    refill_date: string | null;
    confidence: "high" | "medium" | "low" | "none";
    missing_variables_prompt: string | null;
}

const MANUFACTURER_DEFAULTS: Record<string, number> = {
    patch_pump: 3,
    cgm_sensor: 10,
    infusion_set: 3,
};

const FIXED_WEAR_CATEGORIES = ["patch_pump", "cgm_sensor", "infusion_set"];
const VARIABLE_CATEGORIES = ["insulin", "insulin_vial", "insulin_pen"];

const UNITS_PER_ITEM: Record<string, number> = {
    insulin_vial: 1000,
    insulin_pen: 300,
    insulin: 300,
};

export function estimateDuration(
    topMatch: APIMatchCandidate,
    extraction: OCRExtractionResult,
    profile: UserProfile
): DurationResult {
    const stage = "DURATION_ESTIMATION";
    logger.log(stage, `Starting estimation for ${topMatch.name}`, "INFO");

    try {
        const category = topMatch.category;
        const quantity = extraction.parsedData.quantity;
        let estimatedDays: number | null = null;
        let confidence: DurationResult["confidence"] = "none";
        let prompt: string | null = null;

        // ── PATHWAY A: Fixed Wear ──────────────────────
        if (FIXED_WEAR_CATEGORIES.includes(category)) {
            const userOverride = profile.frequency_overrides?.[topMatch.id];
            const wearDays = userOverride ?? MANUFACTURER_DEFAULTS[category];

            if (!wearDays) {
                prompt = `How many days do you typically wear one ${topMatch.name}?`;
            } else if (!quantity) {
                prompt = `How many ${topMatch.name} did you receive in this package?`;
            } else {
                estimatedDays = quantity * wearDays;
                confidence = userOverride ? "high" : "medium";
            }
        }

        // ── PATHWAY B: Variable Consumption ─────────────────────────
        else if (VARIABLE_CATEGORIES.includes(category)) {
            const tdd = (profile.average_daily_basal ?? 0) + (profile.average_daily_bolus ?? 0);

            if (tdd <= 0) {
                prompt = `To calculate your refill date for ${topMatch.name}, what is your average Total Daily Dose?`;
            } else if (!quantity) {
                prompt = `How many ${topMatch.name} did you receive in this package?`;
            } else {
                const unitsPerItem = UNITS_PER_ITEM[category] ?? 300;
                const totalUnits = quantity * unitsPerItem;
                const usableUnits = totalUnits * 0.95; 
                estimatedDays = Math.floor(usableUnits / tdd);
                confidence = "medium";
            }
        } else {
            prompt = `We don't have a usage profile for "${topMatch.category}". How often do you use one ${topMatch.name}?`;
            logger.log(stage, `Unknown category: ${category}`, "WARN");
        }

        // Integrity Check: Suspicious Durations
        if (estimatedDays !== null && (estimatedDays <= 0 || estimatedDays > 365)) {
            logger.log(stage, `Suspicious duration calculated: ${estimatedDays} days`, "WARN");
            confidence = "low";
        }

        const refillDate = estimatedDays
            ? new Date(Date.now() + estimatedDays * 86400000).toISOString()
            : null;

        const result = {
            estimated_duration_days: estimatedDays,
            refill_date: refillDate,
            confidence,
            missing_variables_prompt: prompt,
        };

        logger.log(stage, "Estimation complete", "INFO", { result });
        return result;

    } catch (err: any) {
        logger.log(stage, `Estimation failure: ${err.message}`, "ERROR");
        return { estimated_duration_days: null, refill_date: null, confidence: "none", missing_variables_prompt: "Internal calculation error." };
    }
}

