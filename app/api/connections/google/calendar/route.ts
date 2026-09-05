import {
    NextResponse,
} from "next/server";

import {
    createClient,
} from "@/lib/supabase/server";

import {
    decryptGoogleToken,
    revokeGoogleToken,
} from "@/lib/googleCalendar";

/* =========================================
   AUTH
========================================= */

async function getAuthenticatedContext() {
    const supabase =
        await createClient();

    const {
        data: { user },
        error,
    } =
        await supabase.auth.getUser();

    return {
        supabase,
        user:
            error
                ? null
                : user,
    };
}

/* =========================================
   GET
   Connection status only.
   Never returns OAuth tokens.
========================================= */

export async function GET() {
    try {
        const {
            supabase,
            user,
        } =
            await getAuthenticatedContext();

        if (!user) {
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
            data:
                connection,
            error,
        } =
            await supabase
                .from(
                    "google_calendar_connections"
                )
                .select(
                    `
                        account_email,
                        connected_at,
                        updated_at
                    `
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();

        if (error) {
            console.error(
                "Could not load Google Calendar connection:",
                error
            );

            return NextResponse.json(
                {
                    error:
                        "Could not load Google Calendar connection.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                connected:
                    Boolean(
                        connection
                    ),

                accountEmail:
                    connection
                        ?.account_email ||
                    null,

                connectedAt:
                    connection
                        ?.connected_at ||
                    null,

                updatedAt:
                    connection
                        ?.updated_at ||
                    null,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Google Calendar connection GET error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Could not load Google Calendar connection.",
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================
   DELETE
   Revoke Google token best-effort, then
   remove the Atlas-side connection.
========================================= */

export async function DELETE() {
    try {
        const {
            supabase,
            user,
        } =
            await getAuthenticatedContext();

        if (!user) {
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
            data:
                connection,
            error:
                loadError,
        } =
            await supabase
                .from(
                    "google_calendar_connections"
                )
                .select(
                    `
                        access_token_encrypted,
                        refresh_token_encrypted
                    `
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();

        if (loadError) {
            console.error(
                "Could not load Google Calendar connection before disconnect:",
                loadError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not disconnect Google Calendar.",
                },
                {
                    status: 500,
                }
            );
        }

        if (connection) {
            try {
                const encryptedToken =
                    connection
                        .refresh_token_encrypted ||
                    connection
                        .access_token_encrypted;

                const token =
                    decryptGoogleToken(
                        encryptedToken
                    );

                await revokeGoogleToken(
                    token
                );
            } catch (error) {
                console.warn(
                    "Google token revocation could not complete. Removing local connection anyway:",
                    error
                );
            }
        }

        const {
            error:
                deleteError,
        } =
            await supabase
                .from(
                    "google_calendar_connections"
                )
                .delete()
                .eq(
                    "user_id",
                    user.id
                );

        if (deleteError) {
            console.error(
                "Could not delete Google Calendar connection:",
                deleteError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not disconnect Google Calendar.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                connected:
                    false,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Google Calendar connection DELETE error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Could not disconnect Google Calendar.",
            },
            {
                status: 500,
            }
        );
    }
}
