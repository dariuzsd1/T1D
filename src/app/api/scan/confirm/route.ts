import { NextRequest, NextResponse } from "next/server";
import { estimateDuration, UserProfile } from "@/lib/durationEstimator";
import { APIMatchCandidate } from "@/lib/apiMatcher";
import { OCRExtractionResult } from "@/lib/ocrExtractor";

/**
 * POST /api/scan/confirm
 *
 * User Confirmation & Override endpoint.
 * Called when the user has reviewed the AI's suggestions and finalized their selection.
 * Accepts user-edited fields and returns a recalculated duration estimate.
 * This is the last step before data is written to the database.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // --- Build confirmed product from user's selections ---
        // The user may have overridden the AI's guess at any field
        const confirmedMatch: APIMatchCandidate = {
            id: body.confirmed_product_id,
            brand: body.confirmed_brand,
            name: body.confirmed_product_name,
            category: body.confirmed_category,
            confidenceScore: 100, // User confirmed = 100% trust
        };

        // Reconstruct extraction with user-approved quantity
        const confirmedExtraction: OCRExtractionResult = {
            status: "SUCCESS",
            raw_input: body.raw_input ?? "",
            parsedData: {
                product_name: body.confirmed_product_name,
                brand: body.confirmed_brand,
                product_category: body.confirmed_category,
                quantity: body.confirmed_quantity ?? null,
            },
            confidence: { total: 100 },
            mismatchesLog: [],
        };

        const profile: UserProfile = body.user_profile ?? {};

        if (!confirmedMatch.id || !confirmedMatch.name || !confirmedMatch.brand) {
            return NextResponse.json({
                status: "ERROR",
                message: "confirmed_product_id, confirmed_brand, and confirmed_product_name are all required.",
            }, { status: 400 });
        }

        // Recalculate duration with confirmed data
        const duration = estimateDuration(confirmedMatch, confirmedExtraction, profile);

        return NextResponse.json({
            status: "CONFIRMED",
            confirmed_product: confirmedMatch,
            confirmed_quantity: body.confirmed_quantity,
            duration,
            // This payload is ready to write to the refill_events DB table
            db_ready_payload: {
                product_id: confirmedMatch.id,
                product_name: confirmedMatch.name,
                brand: confirmedMatch.brand,
                category: confirmedMatch.category,
                quantity_added: body.confirmed_quantity,
                estimated_depletion_date: duration.refill_date,
                frontend_approved_at: new Date().toISOString(),
            },
        });

    } catch (err: any) {
        return NextResponse.json({
            status: "ERROR",
            message: err?.message ?? "Confirm route failed",
        }, { status: 500 });
    }
}
