import {
    NextResponse,
} from "next/server";

import {
    createClient,
} from "@/lib/supabase/server";

import {
    getGoogleCalendarAccessToken,
    GoogleCalendarReconnectRequiredError,
    googleCalendarFetch,
} from "@/lib/googleCalendarConnection";

type GoogleCalendarListItem = {
    id?: string;
    summary?: string;
    summaryOverride?: string;
    primary?: boolean;
    accessRole?: string;
    timeZone?: string;
    hidden?: boolean;
    selected?: boolean;
};

type GoogleCalendarListResponse = {
    items?: GoogleCalendarListItem[];
    nextPageToken?: string;
};

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

        const accessToken =
            await getGoogleCalendarAccessToken(
                supabase,
                user.id
            );

        const calendars:
            Array<{
                id: string;
                name: string;
                primary: boolean;
                accessRole: string | null;
                timeZone: string | null;
            }> = [];

        let pageToken:
            string | null =
            null;

        do {
            const url =
                new URL(
                    "https://www.googleapis.com/calendar/v3/users/me/calendarList"
                );

            url.searchParams.set(
                "maxResults",
                "250"
            );

            url.searchParams.set(
                "showHidden",
                "false"
            );

            if (pageToken) {
                url.searchParams.set(
                    "pageToken",
                    pageToken
                );
            }

            const response =
                await googleCalendarFetch(
                    accessToken,
                    url.toString()
                );

            const payload =
                (await response.json()) as
                    GoogleCalendarListResponse;

            if (!response.ok) {
                console.error(
                    "Google Calendar list failed:",
                    payload
                );

                return NextResponse.json(
                    {
                        error:
                            "Could not load Google calendars.",
                    },
                    {
                        status:
                            response.status,
                    }
                );
            }

            for (
                const calendar
                of payload.items ??
                []
            ) {
                if (
                    !calendar.id
                ) {
                    continue;
                }

                calendars.push({
                    id:
                        calendar.id,

                    name:
                        (
                            calendar
                                .summaryOverride ||
                            calendar.summary ||
                            calendar.id
                        ).trim(),

                    primary:
                        Boolean(
                            calendar.primary
                        ),

                    accessRole:
                        calendar
                            .accessRole ||
                        null,

                    timeZone:
                        calendar
                            .timeZone ||
                        null,
                });
            }

            pageToken =
                payload.nextPageToken ||
                null;
        } while (pageToken);

        calendars.sort(
            (a, b) => {
                if (
                    a.primary !==
                    b.primary
                ) {
                    return a.primary
                        ? -1
                        : 1;
                }

                return a.name.localeCompare(
                    b.name
                );
            }
        );

        return NextResponse.json({
            calendars,
        });
    } catch (error) {
        console.error(
            "Google Calendar calendars route failed:",
            error
        );

        if (
            error instanceof
            GoogleCalendarReconnectRequiredError
        ) {
            return NextResponse.json(
                {
                    error:
                        error.message,

                    reconnectRequired:
                        true,
                },
                {
                    status: 401,
                }
            );
        }

        return NextResponse.json(
            {
                error:
                    "Could not load Google calendars.",
            },
            {
                status: 500,
            }
        );
    }
}
