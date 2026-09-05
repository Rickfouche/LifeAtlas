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

type GoogleEventDate = {
    date?: string;
    dateTime?: string;
    timeZone?: string;
};

type GoogleCalendarEvent = {
    id?: string;
    recurringEventId?: string;
    summary?: string;
    status?: string;
    start?: GoogleEventDate;
    end?: GoogleEventDate;
    originalStartTime?: GoogleEventDate;
};

type GoogleEventsResponse = {
    items?: GoogleCalendarEvent[];
    nextPageToken?: string;
};

type AtlasCalendarOccurrence = {
    eventId: string;
    seriesId: string | null;
    title: string;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
    timezone: string | null;
};

function normalizeEventDate(
    value:
        | GoogleEventDate
        | undefined
) {
    if (
        value?.dateTime
    ) {
        const parsed =
            new Date(
                value.dateTime
            );

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            return null;
        }

        return {
            iso:
                parsed.toISOString(),

            allDay:
                false,

            timezone:
                value.timeZone ||
                null,
        };
    }

    if (
        value?.date
    ) {
        /*
          Date-only Google Calendar events are
          kept on their intended calendar day.
          Noon UTC avoids accidental previous-day
          display in most Atlas date-only flows.
        */
        const parsed =
            new Date(
                `${value.date}T12:00:00.000Z`
            );

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            return null;
        }

        return {
            iso:
                parsed.toISOString(),

            allDay:
                true,

            timezone:
                value.timeZone ||
                null,
        };
    }

    return null;
}

export async function GET(
    request: Request
) {
    try {
        const requestUrl =
            new URL(
                request.url
            );

        const calendarId =
            requestUrl.searchParams
                .get(
                    "calendarId"
                )
                ?.trim();

        if (!calendarId) {
            return NextResponse.json(
                {
                    error:
                        "calendarId is required.",
                },
                {
                    status: 400,
                }
            );
        }

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

        const occurrences:
            AtlasCalendarOccurrence[] =
            [];

        let pageToken:
            string | null =
            null;

        let pageCount = 0;

        /*
          singleEvents=true expands recurring
          series into their individual instances.
          recurringEventId then lets Atlas group
          those instances back into a series.
        */
        do {
            const url =
                new URL(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                        calendarId
                    )}/events`
                );

            url.searchParams.set(
                "singleEvents",
                "true"
            );

            url.searchParams.set(
                "orderBy",
                "startTime"
            );

            url.searchParams.set(
                "showDeleted",
                "false"
            );

            url.searchParams.set(
                "timeMin",
                new Date().toISOString()
            );

            url.searchParams.set(
                "maxResults",
                "2500"
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
                GoogleEventsResponse;

            if (!response.ok) {
                console.error(
                    "Google Calendar events list failed:",
                    payload
                );

                return NextResponse.json(
                    {
                        error:
                            "Could not load future Calendar events.",
                    },
                    {
                        status:
                            response.status,
                    }
                );
            }

            for (
                const event
                of payload.items ??
                []
            ) {
                if (
                    !event.id ||
                    event.status ===
                    "cancelled"
                ) {
                    continue;
                }

                const start =
                    normalizeEventDate(
                        event.start
                    );

                if (!start) {
                    continue;
                }

                const end =
                    normalizeEventDate(
                        event.end
                    );

                occurrences.push({
                    eventId:
                        event.id,

                    seriesId:
                        event
                            .recurringEventId ||
                        null,

                    title:
                        event.summary?.trim() ||
                        "UNTITLED EVENT",

                    startAt:
                        start.iso,

                    /*
                      Atlas's current Moment model
                      uses end_at for ranges rather
                      than ordinary event duration,
                      so timed event duration is not
                      converted into a Moment range.
                    */
                    endAt:
                        null,

                    allDay:
                        start.allDay,

                    timezone:
                        start.timezone ||
                        end?.timezone ||
                        null,
                });
            }

            pageToken =
                payload.nextPageToken ||
                null;

            pageCount += 1;

            /*
              Defensive ceiling. For a normal class
              calendar this will never be reached,
              while still preventing an accidental
              endless pagination loop.
            */
            if (
                pageCount >= 4
            ) {
                pageToken = null;
            }
        } while (pageToken);

        const groups =
            new Map<
                string,
                {
                    id: string;
                    title: string;
                    recurring: boolean;
                    occurrences:
                    AtlasCalendarOccurrence[];
                }
            >();

        for (
            const occurrence
            of occurrences
        ) {
            const groupId =
                occurrence.seriesId ||
                occurrence.eventId;

            const existing =
                groups.get(
                    groupId
                );

            if (existing) {
                existing.occurrences.push(
                    occurrence
                );

                continue;
            }

            groups.set(
                groupId,
                {
                    id:
                        groupId,

                    title:
                        occurrence.title,

                    recurring:
                        Boolean(
                            occurrence.seriesId
                        ),

                    occurrences: [
                        occurrence,
                    ],
                }
            );
        }

        const series =
            Array.from(
                groups.values()
            )
                .map(
                    (group) => ({
                        ...group,

                        occurrenceCount:
                            group
                                .occurrences
                                .length,

                        nextStartAt:
                            group
                                .occurrences[0]
                                ?.startAt ||
                            null,
                    })
                )
                .sort(
                    (a, b) =>
                        new Date(
                            a.nextStartAt ||
                            0
                        ).getTime() -
                        new Date(
                            b.nextStartAt ||
                            0
                        ).getTime()
                );

        return NextResponse.json({
            series,
        });
    } catch (error) {
        console.error(
            "Google Calendar series route failed:",
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
                    "Could not load future Calendar events.",
            },
            {
                status: 500,
            }
        );
    }
}
