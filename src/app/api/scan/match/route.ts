import { NextRequest, NextResponse } from "next/server";
import { executeAPIMatch } from "@/lib/apiMatcher";
import { OCRExtractionResult } from "@/lib/ocrExtractor";

/**
 * POST /api/scan/match
 *
 * Standalone fuzzy matching endpoint.
 * Accepts structured extraction data and returns Top 3 FDA candidates.
 * Can be called independently if the user wants to re-search after editing fields.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Accept either a full extraction payload or a manual override object
        const input: OCRExtractionResult = {
            status: "SUCCESS",
            raw_input: body.raw_input ?? "",
            parsedData: {
                product_name: body.product_name ?? null,
                brand: body.brand ?? null,
                product_category: body.product_category ?? null,
                quantity: body.quantity ?? null,
            },
            confidence: { total: body.extraction_confidence ?? 80 },
            mismatchesLog: [],
        };

        if (!input.parsedData.brand && !input.parsedData.product_name) {
            return NextResponse.json({
                status: "FAILED",
                message: "At least one of brand or product_name is required to search.",
                matches: [],
            }, { status: 400 });
        }

        const result = executeAPIMatch(input);

        return NextResponse.json({
            status: result.status,
            top_matches: result.topMatches,
            logs: result.matchLogs,
        });

    } catch (err: any) {
        return NextResponse.json({
            status: "ERROR",
            message: err?.message ?? "Match route failed",
        }, { status: 500 });
    }
}
