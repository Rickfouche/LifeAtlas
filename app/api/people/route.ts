import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   HELPERS
========================================= */

function normalizeString(
    value: unknown
) {
    return typeof value === "string"
        ? value.trim()
        : "";
}

function normalizeNullableString(
    value: unknown
) {
    const valueString =
        normalizeString(
            value
        );

    return valueString || null;
}

function normalizeStringArray(
    value: unknown
) {
    if (
        !Array.isArray(
            value
        )
    ) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .filter(
                    (item) =>
                        typeof item ===
                        "string"
                )
                .map(
                    (item) =>
                        item.trim()
                )
                .filter(Boolean)
        )
    );
}

function normalizeObject(
    value: unknown
) {
    if (
        value &&
        typeof value ===
        "object" &&
        !Array.isArray(
            value
        )
    ) {
        return value;
    }

    return {};
}

function normalizeRelationshipState(
    value: unknown
) {
    if (
        value === "active" ||
        value === "hiatus" ||
        value === "dormant" ||
        value === "potential" ||
        value === "archived"
    ) {
        return value;
    }

    return "active";
}

/* =========================================
   GET
   Load all People
========================================= */

export async function GET() {
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

        const {
            data: people,
            error: peopleError,
        } = await supabase
            .from("people")
            .select(`
        id,
        name,
        avatar_url,
        headline,
        company,
        city,
        phone,
        email,
        website,
        birthday,
        roles,
        tags,
        relationship_state,
        social_links,
        notes,
        metadata,
        created_at,
        updated_at
      `)
            .eq(
                "user_id",
                user.id
            )
            .order(
                "name",
                {
                    ascending: true,
                }
            );

        if (peopleError) {
            console.error(
                "Could not load people:",
                peopleError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not load people.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                people:
                    people ?? [],
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas people GET error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected people loading error.",
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================
   POST
   Create Person
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

        const name =
            normalizeString(
                body.name
            );

        if (!name) {
            return NextResponse.json(
                {
                    error:
                        "Name is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            name.length >
            255
        ) {
            return NextResponse.json(
                {
                    error:
                        "Name is too long.",
                },
                {
                    status: 400,
                }
            );
        }

        const birthday =
            normalizeNullableString(
                body.birthday
            );

        const roles =
            normalizeStringArray(
                body.roles
            );

        const tags =
            normalizeStringArray(
                body.tags
            );

        const relationshipState =
            normalizeRelationshipState(
                body.relationshipState
            );

        const socialLinks =
            normalizeObject(
                body.socialLinks
            );

        const metadata =
            normalizeObject(
                body.metadata
            );

        const {
            data: person,
            error: createError,
        } = await supabase
            .from("people")
            .insert({
                user_id:
                    user.id,

                name,

                avatar_url:
                    normalizeNullableString(
                        body.avatarUrl
                    ),

                headline:
                    normalizeNullableString(
                        body.headline
                    ),

                company:
                    normalizeNullableString(
                        body.company
                    ),

                city:
                    normalizeNullableString(
                        body.city
                    ),

                phone:
                    normalizeNullableString(
                        body.phone
                    ),

                email:
                    normalizeNullableString(
                        body.email
                    ),

                website:
                    normalizeNullableString(
                        body.website
                    ),

                birthday,

                roles,

                tags,

                relationship_state:
                    relationshipState,

                social_links:
                    socialLinks,

                notes:
                    normalizeNullableString(
                        body.notes
                    ),

                metadata,
            })
            .select(`
        id,
        name,
        avatar_url,
        headline,
        company,
        city,
        phone,
        email,
        website,
        birthday,
        roles,
        tags,
        relationship_state,
        social_links,
        notes,
        metadata,
        created_at,
        updated_at
      `)
            .single();

        if (
            createError ||
            !person
        ) {
            console.error(
                "Could not create person:",
                createError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not create person.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                person,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Atlas people POST error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected person creation error.",
            },
            {
                status: 500,
            }
        );
    }
}