import {
    randomUUID,
} from "node:crypto";

import {
    NextResponse,
} from "next/server";

import {
    createClient,
} from "@/lib/supabase/server";

import {
    getGoogleCalendarClientId,
    getGoogleCalendarRedirectUri,
    GOOGLE_CALENDAR_SCOPES,
    GOOGLE_CALENDAR_STATE_COOKIE,
} from "@/lib/googleCalendar";

/* =========================================
   GET
   Begin Google Calendar OAuth
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
            return NextResponse.redirect(
                new URL(
                    "/login",
                    request.url
                )
            );
        }

        const state =
            randomUUID();

        const authorizationUrl =
            new URL(
                "https://accounts.google.com/o/oauth2/v2/auth"
            );

        authorizationUrl.search =
            new URLSearchParams({
                client_id:
                    getGoogleCalendarClientId(),

                redirect_uri:
                    getGoogleCalendarRedirectUri(
                        request
                    ),

                response_type:
                    "code",

                access_type:
                    "offline",

                prompt:
                    "consent",

                include_granted_scopes:
                    "true",

                scope:
                    GOOGLE_CALENDAR_SCOPES.join(
                        " "
                    ),

                state,
            }).toString();

        const response =
            NextResponse.redirect(
                authorizationUrl
            );

        response.cookies.set(
            GOOGLE_CALENDAR_STATE_COOKIE,
            state,
            {
                httpOnly: true,
                secure:
                    process.env
                        .NODE_ENV ===
                    "production",
                sameSite:
                    "lax",
                path: "/",
                maxAge:
                    10 * 60,
            }
        );

        return response;
    } catch (error) {
        console.error(
            "Google Calendar OAuth start error:",
            error
        );

        return NextResponse.redirect(
            new URL(
                "/?google_calendar=configuration_error",
                request.url
            )
        );
    }
}
