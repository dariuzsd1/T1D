import { NextRequest, NextResponse } from "next/server";
import { estimateDuration, UserProfile } from "@/lib/durationEstimator";
import { APIMatchCandidate } from "@/lib/apiMatcher";
import { OCRExtractionResult } from "@/lib/ocrExtractor";

/**
 * POST /api/inventory/duration
 *
 * Standalone duration recalculation endpoint.
 * Called when the user updates their usage profile (e.g. changes TDD)
 * and wants to re-estimate existing inventory without re-scanning.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const product: APIMatchCandidate = {
            id: body.product_id,
            brand: body.brand,
            name: body.product_name,
            category: body.category,
            confidenceScore: 100,
        };

        const extraction: OCRExtractionResult = {
            status: "SUCCESS",
            raw_input: "",
            parsedData: {
                product_name: body.product_name,
                brand: body.brand,
                product_category: body.category,
                quantity: body.quantity ?? null,
            },
            confidence: { total: 100 },
            mismatchesLog: [],
        };

        const profile: UserProfile = {
            average_daily_basal: body.average_daily_basal,
            average_daily_bolus: body.average_daily_bolus,
            frequency_overrides: body.frequency_overrides,
        };

        if (!product.id || !product.category || !body.quantity) {
            return NextResponse.json({
                status: "ERROR",
                message: "product_id, category, and quantity are required.",
            }, { status: 400 });
        }

        const duration = estimateDuration(product, extraction, profile);

        return NextResponse.json({
            status: "OK",
            product_id: body.product_id,
            quantity: body.quantity,
            duration,
        });

    } catch (err: any) {
        return NextResponse.json({
            status: "ERROR",
            message: err?.message ?? "Duration route failed",
        }, { status: 500 });
    }
}
