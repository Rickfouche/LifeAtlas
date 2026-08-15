import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   HELPERS
========================================= */

function normalizeMomentType(
    value: unknown
) {
    if (
        value === "date" ||
        value === "datetime" ||
        value === "range"
    ) {
        return value;
    }

    return "date";
}

function normalizeNullableString(
    value: unknown
) {
    if (
        typeof value !== "string"
    ) {
        return null;
    }

    const trimmed =
        value.trim();

    return trimmed || null;
}

/* =========================================
   GET
   Load all moments for a pin
========================================= */

export async function GET(
    request: Request
) {
    try {
        const supabase =
            await createClient();

        const {
            data: { user },
            error: userError,
        } =
            await supabase.auth.getUser();

        if (
            userError ||
            !user
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        const { searchParams } =
            new URL(
                request.url
            );

        const pinId =
            searchParams.get(
                "pinId"
            );

        if (!pinId) {
            return NextResponse.json(
                {
                    error:
                        "Pin ID is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const {
            data: pin,
            error: pinError,
        } = await supabase
            .from("pins")
            .select("id")
            .eq(
                "id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
            .single();

        if (
            pinError ||
            !pin
        ) {
            return NextResponse.json(
                {
                    error:
                        "Pin not found.",
                },
                {
                    status: 404,
                }
            );
        }

        const {
            data: moments,
            error: momentsError,
        } = await supabase
            .from("pin_moments")
            .select(`
        id,
        pin_id,
        title,
        moment_type,
        start_at,
        end_at,
        timezone,
        notes,
        metadata,
        created_at,
        updated_at
      `)
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
            .order(
                "start_at",
                {
                    ascending: true,
                }
            );

        if (momentsError) {
            console.error(
                "Could not load pin moments:",
                momentsError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not load moments.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                moments:
                    moments ?? [],
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas pin moments GET error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected moment loading error.",
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================
   POST
   Create a moment
========================================= */

export async function POST(
    request: Request
) {
    try {
        const supabase =
            await createClient();

        const {
            data: { user },
            error: userError,
        } =
            await supabase.auth.getUser();

        if (
            userError ||
            !user
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        const body =
            await request.json();

        const pinId =
            typeof body.pinId ===
                "string"
                ? body.pinId.trim()
                : "";

        if (!pinId) {
            return NextResponse.json(
                {
                    error:
                        "Pin ID is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const {
            data: pin,
            error: pinError,
        } = await supabase
            .from("pins")
            .select("id")
            .eq(
                "id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
            .single();

        if (
            pinError ||
            !pin
        ) {
            return NextResponse.json(
                {
                    error:
                        "Pin not found.",
                },
                {
                    status: 404,
                }
            );
        }

        const momentType =
            normalizeMomentType(
                body.momentType
            );

        const title =
            normalizeNullableString(
                body.title
            );

        const timezone =
            normalizeNullableString(
                body.timezone
            );

        const notes =
            normalizeNullableString(
                body.notes
            );

        const startAt =
            typeof body.startAt ===
                "string"
                ? body.startAt.trim()
                : "";

        const endAt =
            typeof body.endAt ===
                "string"
                ? body.endAt.trim()
                : "";

        if (!startAt) {
            return NextResponse.json(
                {
                    error:
                        "Start date is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const startDate =
            new Date(startAt);

        if (
            Number.isNaN(
                startDate.getTime()
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Start date is invalid.",
                },
                {
                    status: 400,
                }
            );
        }

        let normalizedEndAt:
            string | null =
            null;

        if (
            momentType === "range"
        ) {
            if (!endAt) {
                return NextResponse.json(
                    {
                        error:
                            "End date is required for a range.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const endDate =
                new Date(endAt);

            if (
                Number.isNaN(
                    endDate.getTime()
                )
            ) {
                return NextResponse.json(
                    {
                        error:
                            "End date is invalid.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                endDate.getTime() <
                startDate.getTime()
            ) {
                return NextResponse.json(
                    {
                        error:
                            "End date cannot be before start date.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            normalizedEndAt =
                endDate.toISOString();
        }

        const metadata =
            body.metadata &&
                typeof body.metadata ===
                "object" &&
                !Array.isArray(
                    body.metadata
                )
                ? body.metadata
                : {};

        const {
            data: moment,
            error: createError,
        } = await supabase
            .from("pin_moments")
            .insert({
                user_id:
                    user.id,

                pin_id:
                    pinId,

                title,

                moment_type:
                    momentType,

                start_at:
                    startDate.toISOString(),

                end_at:
                    normalizedEndAt,

                timezone,

                notes,

                metadata,
            })
            .select(`
        id,
        pin_id,
        title,
        moment_type,
        start_at,
        end_at,
        timezone,
        notes,
        metadata,
        created_at,
        updated_at
      `)
            .single();

        if (
            createError ||
            !moment
        ) {
            console.error(
                "Could not create pin moment:",
                createError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not create moment.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                moment,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Atlas pin moments POST error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected moment creation error.",
            },
            {
                status: 500,
            }
        );
    }
}