import type {
    SupabaseClient,
} from "@supabase/supabase-js";

import {
    decryptGoogleToken,
    encryptGoogleToken,
    getGoogleCalendarClientId,
    getGoogleCalendarClientSecret,
} from "@/lib/googleCalendar";

type StoredGoogleCalendarConnection = {
    access_token_encrypted: string;
    refresh_token_encrypted: string | null;
    expires_at: string | null;
};

type GoogleRefreshResponse = {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
};

export class GoogleCalendarReconnectRequiredError
    extends Error {
    constructor() {
        super(
            "Google Calendar needs to be connected again."
        );

        this.name =
            "GoogleCalendarReconnectRequiredError";
    }
}

export async function getGoogleCalendarAccessToken(
    supabase: SupabaseClient,
    userId: string
) {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "google_calendar_connections"
            )
            .select(
                `
                    access_token_encrypted,
                    refresh_token_encrypted,
                    expires_at
                `
            )
            .eq(
                "user_id",
                userId
            )
            .maybeSingle();

    if (
        error ||
        !data
    ) {
        throw new GoogleCalendarReconnectRequiredError();
    }

    const connection =
        data as StoredGoogleCalendarConnection;

    const expiresAt =
        connection.expires_at
            ? new Date(
                connection.expires_at
            ).getTime()
            : 0;

    /*
      Give ourselves a 60-second buffer so an
      access token does not expire mid-request.
    */
    if (
        expiresAt >
        Date.now() + 60_000
    ) {
        return decryptGoogleToken(
            connection
                .access_token_encrypted
        );
    }

    if (
        !connection
            .refresh_token_encrypted
    ) {
        throw new GoogleCalendarReconnectRequiredError();
    }

    const refreshToken =
        decryptGoogleToken(
            connection
                .refresh_token_encrypted
        );

    const response =
        await fetch(
            "https://oauth2.googleapis.com/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },

                body:
                    new URLSearchParams({
                        client_id:
                            getGoogleCalendarClientId(),

                        client_secret:
                            getGoogleCalendarClientSecret(),

                        refresh_token:
                            refreshToken,

                        grant_type:
                            "refresh_token",
                    }),

                cache: "no-store",
            }
        );

    const payload =
        (await response.json()) as
            GoogleRefreshResponse;

    if (
        !response.ok ||
        !payload.access_token
    ) {
        console.error(
            "Google Calendar token refresh failed:",
            payload
        );

        throw new GoogleCalendarReconnectRequiredError();
    }

    const nextExpiresAt =
        typeof payload.expires_in ===
            "number"
            ? new Date(
                Date.now() +
                payload.expires_in *
                1000
            ).toISOString()
            : null;

    const {
        error:
            updateError,
    } =
        await supabase
            .from(
                "google_calendar_connections"
            )
            .update({
                access_token_encrypted:
                    encryptGoogleToken(
                        payload.access_token
                    ),

                /*
                  Google normally does not return
                  a new refresh token here.
                */
                refresh_token_encrypted:
                    payload.refresh_token
                        ? encryptGoogleToken(
                            payload.refresh_token
                        )
                        : connection
                            .refresh_token_encrypted,

                expires_at:
                    nextExpiresAt,

                updated_at:
                    new Date().toISOString(),
            })
            .eq(
                "user_id",
                userId
            );

    if (updateError) {
        console.error(
            "Could not persist refreshed Google Calendar token:",
            updateError
        );
    }

    return payload.access_token;
}

export async function googleCalendarFetch(
    accessToken: string,
    url: string
) {
    const response =
        await fetch(
            url,
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,
                },

                cache: "no-store",
            }
        );

    if (
        response.status === 401
    ) {
        throw new GoogleCalendarReconnectRequiredError();
    }

    return response;
}
