import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
} from "node:crypto";

/* =========================================
   GOOGLE CALENDAR OAUTH CONSTANTS
========================================= */

export const GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;

export const GOOGLE_CALENDAR_STATE_COOKIE =
    "atlas_google_calendar_oauth_state";

export const GOOGLE_CALENDAR_CALLBACK_PATH =
    "/api/connections/google/calendar/callback";

/* =========================================
   ENVIRONMENT
========================================= */

function requireEnv(
    name: string
) {
    const value =
        process.env[name]?.trim();

    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}`
        );
    }

    return value;
}

export function getGoogleCalendarClientId() {
    return requireEnv(
        "GOOGLE_CALENDAR_CLIENT_ID"
    );
}

export function getGoogleCalendarClientSecret() {
    return requireEnv(
        "GOOGLE_CALENDAR_CLIENT_SECRET"
    );
}

export function getGoogleCalendarRedirectUri(
    request: Request
) {
    const explicit =
        process.env
            .GOOGLE_CALENDAR_REDIRECT_URI
            ?.trim();

    if (explicit) {
        return explicit;
    }

    return `${
        new URL(
            request.url
        ).origin
    }${GOOGLE_CALENDAR_CALLBACK_PATH}`;
}

/* =========================================
   TOKEN ENCRYPTION

   Format:
   iv.authTag.ciphertext
   (all base64url)

   This keeps Google tokens unreadable in the
   database and in accidental table reads.
========================================= */

function getTokenEncryptionKey() {
    const encoded =
        requireEnv(
            "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY"
        );

    let key: Buffer;

    try {
        key =
            Buffer.from(
                encoded,
                "base64"
            );
    } catch {
        throw new Error(
            "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key."
        );
    }

    if (
        key.length !== 32
    ) {
        throw new Error(
            "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes."
        );
    }

    return key;
}

export function encryptGoogleToken(
    value: string
) {
    const iv =
        randomBytes(12);

    const cipher =
        createCipheriv(
            "aes-256-gcm",
            getTokenEncryptionKey(),
            iv
        );

    const encrypted =
        Buffer.concat([
            cipher.update(
                value,
                "utf8"
            ),
            cipher.final(),
        ]);

    const authTag =
        cipher.getAuthTag();

    return [
        iv.toString(
            "base64url"
        ),
        authTag.toString(
            "base64url"
        ),
        encrypted.toString(
            "base64url"
        ),
    ].join(".");
}

export function decryptGoogleToken(
    value: string
) {
    const [
        ivPart,
        tagPart,
        encryptedPart,
    ] =
        value.split(".");

    if (
        !ivPart ||
        !tagPart ||
        !encryptedPart
    ) {
        throw new Error(
            "Stored Google token has an invalid encrypted format."
        );
    }

    const decipher =
        createDecipheriv(
            "aes-256-gcm",
            getTokenEncryptionKey(),
            Buffer.from(
                ivPart,
                "base64url"
            )
        );

    decipher.setAuthTag(
        Buffer.from(
            tagPart,
            "base64url"
        )
    );

    const decrypted =
        Buffer.concat([
            decipher.update(
                Buffer.from(
                    encryptedPart,
                    "base64url"
                )
            ),
            decipher.final(),
        ]);

    return decrypted.toString(
        "utf8"
    );
}

/* =========================================
   GOOGLE RESPONSE TYPES
========================================= */

export type GoogleTokenResponse = {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
};

type GoogleCalendarListEntry = {
    id?: string;
    primary?: boolean;
};

type GoogleCalendarListResponse = {
    items?: GoogleCalendarListEntry[];
};

/* =========================================
   GOOGLE REQUEST HELPERS
========================================= */

export async function exchangeGoogleCalendarCode(
    request: Request,
    code: string
) {
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

                        code,

                        grant_type:
                            "authorization_code",

                        redirect_uri:
                            getGoogleCalendarRedirectUri(
                                request
                            ),
                    }),
            }
        );

    const payload =
        (await response.json()) as
            GoogleTokenResponse;

    if (
        !response.ok ||
        !payload.access_token
    ) {
        console.error(
            "Google Calendar token exchange failed:",
            payload
        );

        throw new Error(
            payload.error_description ||
            "Google Calendar authorization could not be completed."
        );
    }

    return payload;
}

export async function getGoogleCalendarAccountEmail(
    accessToken: string
) {
    const response =
        await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,
                },

                cache: "no-store",
            }
        );

    if (!response.ok) {
        console.error(
            "Could not read Google Calendar list:",
            response.status,
            await response.text()
        );

        return null;
    }

    const payload =
        (await response.json()) as
            GoogleCalendarListResponse;

    const primary =
        payload.items?.find(
            (calendar) =>
                calendar.primary
        );

    return (
        primary?.id?.trim() ||
        null
    );
}

export async function revokeGoogleToken(
    token: string
) {
    const response =
        await fetch(
            "https://oauth2.googleapis.com/revoke",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },

                body:
                    new URLSearchParams({
                        token,
                    }),
            }
        );

    /*
      Revocation is best-effort during disconnect.
      We still remove the Atlas-side connection if
      Google says the token is already invalid.
    */
    if (!response.ok) {
        console.warn(
            "Google token revocation returned:",
            response.status,
            await response.text()
        );
    }
}
