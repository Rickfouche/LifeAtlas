import {
    NextResponse,
} from "next/server";

import {
    createClient,
} from "@/lib/supabase/server";

import {
    encryptGoogleToken,
    exchangeGoogleCalendarCode,
    getGoogleCalendarAccountEmail,
    GOOGLE_CALENDAR_STATE_COOKIE,
} from "@/lib/googleCalendar";

/* =========================================
   REDIRECT HELPERS
========================================= */

function atlasRedirect(
    request: Request,
    result: string
) {
    return NextResponse.redirect(
        new URL(
            `/?google_calendar=${encodeURIComponent(
                result
            )}`,
            request.url
        )
    );
}

function clearOAuthState(
    response: NextResponse
) {
    response.cookies.set(
        GOOGLE_CALENDAR_STATE_COOKIE,
        "",
        {
            httpOnly: true,
            secure:
                process.env
                    .NODE_ENV ===
                "production",
            sameSite:
                "lax",
            path: "/",
            maxAge: 0,
        }
    );

    return response;
}

/* =========================================
   GET
   Complete Google Calendar OAuth
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
            return clearOAuthState(
                NextResponse.redirect(
                    new URL(
                        "/login",
                        request.url
                    )
                )
            );
        }

        const requestUrl =
            new URL(
                request.url
            );

        const oauthError =
            requestUrl.searchParams.get(
                "error"
            );

        if (oauthError) {
            console.warn(
                "Google Calendar OAuth returned:",
                oauthError
            );

            return clearOAuthState(
                atlasRedirect(
                    request,
                    "cancelled"
                )
            );
        }

        const code =
            requestUrl.searchParams.get(
                "code"
            );

        const returnedState =
            requestUrl.searchParams.get(
                "state"
            );

        const cookieHeader =
            request.headers.get(
                "cookie"
            ) || "";

        const stateMatch =
            cookieHeader
                .split(";")
                .map(
                    (entry) =>
                        entry.trim()
                )
                .find(
                    (entry) =>
                        entry.startsWith(
                            `${GOOGLE_CALENDAR_STATE_COOKIE}=`
                        )
                );

        const storedState =
            stateMatch
                ? decodeURIComponent(
                    stateMatch.slice(
                        GOOGLE_CALENDAR_STATE_COOKIE.length +
                        1
                    )
                )
                : null;

        if (
            !code ||
            !returnedState ||
            !storedState ||
            returnedState !==
            storedState
        ) {
            console.error(
                "Google Calendar OAuth state validation failed."
            );

            return clearOAuthState(
                atlasRedirect(
                    request,
                    "state_error"
                )
            );
        }

        const tokenPayload =
            await exchangeGoogleCalendarCode(
                request,
                code
            );

        const accessToken =
            tokenPayload.access_token!;

        /*
          Reconnecting should not destroy a usable
          refresh token if Google omits a new one.
        */
        const {
            data:
            existingConnection,
        } =
            await supabase
                .from(
                    "google_calendar_connections"
                )
                .select(
                    "refresh_token_encrypted"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();

        const encryptedAccessToken =
            encryptGoogleToken(
                accessToken
            );

        const encryptedRefreshToken =
            tokenPayload.refresh_token
                ? encryptGoogleToken(
                    tokenPayload.refresh_token
                )
                : existingConnection
                    ?.refresh_token_encrypted ||
                null;

        const accountEmail =
            await getGoogleCalendarAccountEmail(
                accessToken
            );

        const expiresAt =
            typeof tokenPayload.expires_in ===
                "number"
                ? new Date(
                    Date.now() +
                    tokenPayload.expires_in *
                    1000
                ).toISOString()
                : null;

        const now =
            new Date().toISOString();

        const {
            error: saveError,
        } =
            await supabase
                .from(
                    "google_calendar_connections"
                )
                .upsert(
                    {
                        user_id:
                            user.id,

                        account_email:
                            accountEmail,

                        access_token_encrypted:
                            encryptedAccessToken,

                        refresh_token_encrypted:
                            encryptedRefreshToken,

                        token_type:
                            tokenPayload.token_type ||
                            null,

                        scope:
                            tokenPayload.scope ||
                            null,

                        expires_at:
                            expiresAt,

                        connected_at:
                            now,

                        updated_at:
                            now,
                    },
                    {
                        onConflict:
                            "user_id",
                    }
                );

        if (saveError) {
            console.error(
                "Could not save Google Calendar connection:",
                saveError
            );

            return clearOAuthState(
                atlasRedirect(
                    request,
                    "save_error"
                )
            );
        }

        return clearOAuthState(
            atlasRedirect(
                request,
                "connected"
            )
        );
    } catch (error) {
        console.error(
            "Google Calendar OAuth callback error:",
            error
        );

        return clearOAuthState(
            atlasRedirect(
                request,
                "error"
            )
        );
    }
}
