import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
    params: Promise<{
        pinId: string;
        relationshipId: string;
    }>;
};

/* =========================================
   PATCH
   Update Person context inside one Pin state

   This does NOT edit the Person record itself.
   It edits:
   - role here
   - notes here
   - optional Moment placement
========================================= */

export async function PATCH(
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

        const {
            pinId,
            relationshipId,
        } =
            await context.params;

        if (
            !pinId ||
            !relationshipId
        ) {
            return NextResponse.json(
                {
                    error:
                        "Pin and relationship IDs are required.",
                },
                {
                    status: 400,
                }
            );
        }

        const {
            data: currentRelationship,
            error: relationshipError,
        } = await supabase
            .from("person_pins")
            .select(`
        id,
        person_id,
        pin_id,
        moment_id
      `)
            .eq(
                "id",
                relationshipId
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
            relationshipError ||
            !currentRelationship
        ) {
            return NextResponse.json(
                {
                    error:
                        "Person relationship not found.",
                },
                {
                    status: 404,
                }
            );
        }

        const body =
            await request.json();

        const updates:
            Record<string, unknown> = {};

        if (
            body.roleInContext !==
            undefined
        ) {
            updates.role_in_context =
                typeof body.roleInContext ===
                    "string" &&
                    body.roleInContext.trim()
                    ? body.roleInContext.trim()
                    : null;
        }

        if (
            body.notes !==
            undefined
        ) {
            updates.notes =
                typeof body.notes ===
                    "string" &&
                    body.notes.trim()
                    ? body.notes.trim()
                    : null;
        }

        if (
            body.momentId !==
            undefined
        ) {
            const momentId =
                typeof body.momentId ===
                    "string" &&
                    body.momentId.trim()
                    ? body.momentId.trim()
                    : null;

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

            updates.moment_id =
                momentId;
        }

        const {
            data: relationship,
            error: updateError,
        } = await supabase
            .from("person_pins")
            .update(
                updates
            )
            .eq(
                "id",
                relationshipId
            )
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
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
            updateError ||
            !relationship
        ) {
            if (
                updateError?.code ===
                "23505"
            ) {
                return NextResponse.json(
                    {
                        error:
                            "This person is already attached to that state.",
                    },
                    {
                        status: 409,
                    }
                );
            }

            console.error(
                "Could not update Person context:",
                updateError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not update this Person context.",
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
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas Pin Person PATCH error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected Person context update error.",
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================
   DELETE
   Remove Person from this Pin / Moment only.

   The global Person record survives.
========================================= */

export async function DELETE(
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

        const {
            pinId,
            relationshipId,
        } =
            await context.params;

        if (
            !pinId ||
            !relationshipId
        ) {
            return NextResponse.json(
                {
                    error:
                        "Pin and relationship IDs are required.",
                },
                {
                    status: 400,
                }
            );
        }

        const {
            data: relationship,
            error: relationshipError,
        } = await supabase
            .from("person_pins")
            .select(`
        id,
        person_id
      `)
            .eq(
                "id",
                relationshipId
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
            relationshipError ||
            !relationship
        ) {
            return NextResponse.json(
                {
                    error:
                        "Person relationship not found.",
                },
                {
                    status: 404,
                }
            );
        }

        const {
            error: deleteError,
        } = await supabase
            .from("person_pins")
            .delete()
            .eq(
                "id",
                relationshipId
            )
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            );

        if (deleteError) {
            console.error(
                "Could not remove Person from Pin:",
                deleteError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not remove this Person from the Pin.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                success: true,
                relationshipId,
                personId:
                    relationship.person_id,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas Pin Person DELETE error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected Person relationship deletion error.",
            },
            {
                status: 500,
            }
        );
    }
}