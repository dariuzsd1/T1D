import { APIMatchCandidate } from "./apiMatcher";
import { OCRExtractionResult } from "./ocrExtractor";

export interface UserProfile {
    average_daily_basal?: number;   // Units/day (e.g. 22)
    average_daily_bolus?: number;   // Units/day (e.g. 18)
    frequency_overrides?: Record<string, number>; // product_id -> days per replacement
}

export interface DurationResult {
    estimated_duration_days: number | null;
    refill_date: string | null;
    confidence: "high" | "medium" | "low" | "none";
    missing_variables_prompt: string | null;
}

// Manufacturer defaults (days per unit/replacement)
const MANUFACTURER_DEFAULTS: Record<string, number> = {
    patch_pump: 3,      // Omnipod pods: 3 days
    cgm_sensor: 10,     // Dexcom G6/G7: 10 days
    infusion_set: 3,    // Tandem tubing: 3 days
};

const FIXED_WEAR_CATEGORIES = ["patch_pump", "cgm_sensor", "infusion_set"];
const VARIABLE_CATEGORIES = ["insulin", "insulin_vial", "insulin_pen"];

// Fixed units per item for variable products
const UNITS_PER_ITEM: Record<string, number> = {
    insulin_vial: 1000,     // 10mL @ 100U/mL
    insulin_pen: 300,       // 3mL @ 100U/mL
    insulin: 300,           // Default pen assumption
};

/**
 * Calculates Time-To-Depletion based on matched product & user profile.
 * Never assumes usage blindly — prompts user if any required variable is missing.
 */
export function estimateDuration(
    topMatch: APIMatchCandidate,
    extraction: OCRExtractionResult,
    profile: UserProfile
): DurationResult {
    const category = topMatch.category;
    const quantity = extraction.parsedData.quantity;
    let estimatedDays: number | null = null;
    let confidence: DurationResult["confidence"] = "none";
    let prompt: string | null = null;

    // ── PATHWAY A: Fixed Wear (Pods, Sensors, Sets) ──────────────────────
    if (FIXED_WEAR_CATEGORIES.includes(category)) {

        // Check for user override first
        const userOverride = profile.frequency_overrides?.[topMatch.id];
        const wearDays = userOverride ?? MANUFACTURER_DEFAULTS[category];

        if (!wearDays) {
            prompt = `How many days do you typically wear one ${topMatch.name}?`;
        } else if (!quantity) {
            prompt = `How many ${topMatch.name} did you receive in this package?`;
        } else {
            estimatedDays = quantity * wearDays;
            confidence = userOverride ? "high" : "medium"; // User overrides are more trusted
        }
    }

    // ── PATHWAY B: Variable Consumption (Insulin) ─────────────────────────
    else if (VARIABLE_CATEGORIES.includes(category)) {

        const tdd = (profile.average_daily_basal ?? 0) + (profile.average_daily_bolus ?? 0);

        if (tdd <= 0) {
            prompt = `To calculate your refill date for ${topMatch.name}, what is your average Total Daily Dose (TDD) in units?`;
        } else if (!quantity) {
            prompt = `How many ${topMatch.name} did you receive in this package?`;
        } else {
            const unitsPerItem = UNITS_PER_ITEM[category] ?? 300;
            const totalUnits = quantity * unitsPerItem;
            const usableUnits = totalUnits * 0.95; // 5% waste
            estimatedDays = Math.floor(usableUnits / tdd);
            confidence = "medium"; // Medium as daily bolus fluctuates
        }
    }

    // ── UNKNOWN CATEGORY ─────────────────────────────────────────────────
    else {
        prompt = `We don't have a usage profile for "${topMatch.category}". How often do you use one ${topMatch.name}?`;
    }

    const refillDate = estimatedDays
        ? addDays(new Date(), estimatedDays).toISOString()
        : null;

    return {
        estimated_duration_days: estimatedDays,
        refill_date: refillDate,
        confidence,
        missing_variables_prompt: prompt,
    };
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
