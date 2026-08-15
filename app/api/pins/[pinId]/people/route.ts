import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
    params: Promise<{
        pinId: string;
    }>;
};

/* =========================================
   GET
   Load every Person relationship for Pin

   moment_id = null
   → general / ALL

   moment_id = UUID
   → belongs to that specific Moment
========================================= */

export async function GET(
    _request: Request,
    context: RouteContext
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

        const { pinId } =
            await context.params;

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
            data: relationships,
            error: relationshipsError,
        } = await supabase
            .from("person_pins")
            .select(`
        id,
        person_id,
        pin_id,
        moment_id,
        role_in_context,
        notes,
        created_at,

        person:people (
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
        )
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
                "created_at",
                {
                    ascending: true,
                }
            );

        if (
            relationshipsError
        ) {
            console.error(
                "Could not load Pin people:",
                relationshipsError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not load people for this Pin.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                relationships:
                    relationships ??
                    [],
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas Pin people GET error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected Pin people loading error.",
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================
   POST
   Attach existing Person to Pin context
========================================= */

export async function POST(
    request: Request,
    context: RouteContext
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

        const { pinId } =
            await context.params;

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

        const body =
            await request.json();

        const personId =
            typeof body.personId ===
                "string"
                ? body.personId.trim()
                : "";

        const momentId =
            typeof body.momentId ===
                "string" &&
                body.momentId.trim()
                ? body.momentId.trim()
                : null;

        const roleInContext =
            typeof body.roleInContext ===
                "string" &&
                body.roleInContext.trim()
                ? body.roleInContext.trim()
                : null;

        const notes =
            typeof body.notes ===
                "string" &&
                body.notes.trim()
                ? body.notes.trim()
                : null;

        if (!personId) {
            return NextResponse.json(
                {
                    error:
                        "Person ID is required.",
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
            data: person,
            error: personError,
        } = await supabase
            .from("people")
            .select("id")
            .eq(
                "id",
                personId
            )
            .eq(
                "user_id",
                user.id
            )
            .single();

        if (
            personError ||
            !person
        ) {
            return NextResponse.json(
                {
                    error:
                        "Person not found.",
                },
                {
                    status: 404,
                }
            );
        }

        if (momentId) {
            const {
                data: moment,
                error: momentError,
            } = await supabase
                .from("pin_moments")
                .select("id")
                .eq(
                    "id",
                    momentId
                )
                .eq(
                    "pin_id",
                    pinId
                )
                .eq(
                    "user_id",
                    user.id
                )
                .single();

            if (
                momentError ||
                !moment
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Moment not found for this Pin.",
                    },
                    {
                        status: 400,
                    }
                );
            }
        }

        const {
            data: relationship,
            error: createError,
        } = await supabase
            .from("person_pins")
            .insert({
                user_id:
                    user.id,

                person_id:
                    personId,

                pin_id:
                    pinId,

                moment_id:
                    momentId,

                role_in_context:
                    roleInContext,

                notes,
            })
            .select(`
        id,
        person_id,
        pin_id,
        moment_id,
        role_in_context,
        notes,
        created_at,

        person:people (
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
        )
      `)
            .single();

        if (
            createError ||
            !relationship
        ) {
            if (
                createError?.code ===
                "23505"
            ) {
                return NextResponse.json(
                    {
                        error:
                            "This person is already attached to this state.",
                    },
                    {
                        status: 409,
                    }
                );
            }

            console.error(
                "Could not attach Person to Pin:",
                createError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not attach person to this Pin.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                relationship,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Atlas Pin people POST error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected Pin people creation error.",
            },
            {
                status: 500,
            }
        );
    }
}