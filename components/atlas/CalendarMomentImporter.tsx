"use client";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    AtlasPinMoment,
} from "@/types/atlas";

type CalendarOption = {
    id: string;
    name: string;
    primary: boolean;
    accessRole: string | null;
    timeZone: string | null;
};

type CalendarOccurrence = {
    eventId: string;
    seriesId: string | null;
    title: string;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
    timezone: string | null;
};

type CalendarSeries = {
    id: string;
    title: string;
    recurring: boolean;
    occurrenceCount: number;
    nextStartAt: string | null;
    occurrences: CalendarOccurrence[];
};

type Props = {
    pinId: string;

    onImported: (
        importedMoments:
            AtlasPinMoment[]
    ) => void;

    onCancel: () => void;
};

function formatOccurrence(
    occurrence:
        CalendarOccurrence
) {
    const date =
        new Date(
            occurrence.startAt
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return occurrence.startAt;
    }

    return new Intl.DateTimeFormat(
        "en-US",
        occurrence.allDay
            ? {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
            }
            : {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }
    )
        .format(date)
        .toUpperCase();
}

export default function CalendarMomentImporter({
    pinId,
    onImported,
    onCancel,
}: Props) {
    const [
        calendars,
        setCalendars,
    ] =
        useState<
            CalendarOption[]
        >([]);

    const [
        selectedCalendarId,
        setSelectedCalendarId,
    ] = useState("");

    const [
        series,
        setSeries,
    ] =
        useState<
            CalendarSeries[]
        >([]);

    const [
        selectedSeriesId,
        setSelectedSeriesId,
    ] = useState("");

    const [
        selectedEventIds,
        setSelectedEventIds,
    ] =
        useState<string[]>(
            []
        );

    const [
        isLoadingCalendars,
        setIsLoadingCalendars,
    ] = useState(true);

    const [
        isLoadingSeries,
        setIsLoadingSeries,
    ] = useState(false);

    const [
        isImporting,
        setIsImporting,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        notice,
        setNotice,
    ] = useState("");

    const selectedSeries =
        useMemo(
            () =>
                series.find(
                    (item) =>
                        item.id ===
                        selectedSeriesId
                ) ||
                null,
            [
                series,
                selectedSeriesId,
            ]
        );

    useEffect(() => {
        const loadCalendars =
            async () => {
                setIsLoadingCalendars(
                    true
                );

                setError("");

                try {
                    const response =
                        await fetch(
                            "/api/connections/google/calendar/calendars",
                            {
                                cache:
                                    "no-store",
                            }
                        );

                    const result =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            result.error ||
                            "Could not load calendars."
                        );
                    }

                    const loaded =
                        (
                            result.calendars ||
                            []
                        ) as CalendarOption[];

                    setCalendars(
                        loaded
                    );

                    const primary =
                        loaded.find(
                            (calendar) =>
                                calendar.primary
                        );

                    if (
                        primary
                    ) {
                        setSelectedCalendarId(
                            primary.id
                        );
                    }
                } catch (loadError) {
                    console.error(
                        "Calendar loading failed:",
                        loadError
                    );

                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Could not load calendars."
                    );
                } finally {
                    setIsLoadingCalendars(
                        false
                    );
                }
            };

        void loadCalendars();
    }, []);

    async function chooseCalendar(
        calendarId: string
    ) {
        setSelectedCalendarId(
            calendarId
        );

        setSelectedSeriesId(
            ""
        );

        setSelectedEventIds(
            []
        );

        setSeries([]);

        setNotice("");

        if (!calendarId) {
            return;
        }

        setIsLoadingSeries(
            true
        );

        setError("");

        try {
            const response =
                await fetch(
                    `/api/connections/google/calendar/series?calendarId=${encodeURIComponent(
                        calendarId
                    )}`,
                    {
                        cache:
                            "no-store",
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ||
                    "Could not load future events."
                );
            }

            setSeries(
                (
                    result.series ||
                    []
                ) as CalendarSeries[]
            );
        } catch (loadError) {
            console.error(
                "Calendar event loading failed:",
                loadError
            );

            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Could not load future events."
            );
        } finally {
            setIsLoadingSeries(
                false
            );
        }
    }

    /*
      Auto-load the primary calendar after
      calendars have been discovered.
    */
    useEffect(() => {
        if (
            selectedCalendarId &&
            series.length === 0 &&
            !isLoadingSeries
        ) {
            void chooseCalendar(
                selectedCalendarId
            );
        }
        // The selected ID is the trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedCalendarId,
    ]);

    function chooseSeries(
        seriesId: string
    ) {
        setSelectedSeriesId(
            seriesId
        );

        setNotice("");

        const nextSeries =
            series.find(
                (item) =>
                    item.id ===
                    seriesId
            );

        setSelectedEventIds(
            nextSeries
                ? nextSeries
                    .occurrences
                    .map(
                        (occurrence) =>
                            occurrence
                                .eventId
                    )
                : []
        );
    }

    function toggleOccurrence(
        eventId: string
    ) {
        setSelectedEventIds(
            (current) =>
                current.includes(
                    eventId
                )
                    ? current.filter(
                        (id) =>
                            id !==
                            eventId
                    )
                    : [
                        ...current,
                        eventId,
                    ]
        );
    }

    async function importSelected() {
        if (
            !selectedSeries ||
            !selectedCalendarId ||
            isImporting
        ) {
            return;
        }

        const selectedOccurrences =
            selectedSeries
                .occurrences
                .filter(
                    (occurrence) =>
                        selectedEventIds.includes(
                            occurrence.eventId
                        )
                );

        if (
            selectedOccurrences.length ===
            0
        ) {
            setError(
                "Choose at least one future date."
            );

            return;
        }

        setIsImporting(
            true
        );

        setError("");

        setNotice("");

        const imported:
            AtlasPinMoment[] =
            [];

        let duplicateCount = 0;

        try {
            /*
              Each occurrence is deliberately
              created as an independent Atlas
              Moment. The existing pin-moments
              API owns provenance + duplicate
              protection from Pass 10A.
            */
            for (
                const occurrence
                of selectedOccurrences
            ) {
                const response =
                    await fetch(
                        "/api/pin-moments",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    pinId,

                                    title:
                                        occurrence.title,

                                    momentType:
                                        occurrence.allDay
                                            ? "date"
                                            : "datetime",

                                    startAt:
                                        occurrence.startAt,

                                    endAt:
                                        null,

                                    timezone:
                                        occurrence.timezone ||
                                        Intl
                                            .DateTimeFormat()
                                            .resolvedOptions()
                                            .timeZone ||
                                        "UTC",

                                    notes:
                                        null,

                                    source:
                                        "google_calendar",

                                    externalEventId:
                                        occurrence.eventId,

                                    externalCalendarId:
                                        selectedCalendarId,

                                    externalSeriesId:
                                        occurrence.seriesId,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    response.status ===
                    409
                ) {
                    duplicateCount += 1;
                    continue;
                }

                if (!response.ok) {
                    throw new Error(
                        result.error ||
                        "A Calendar date could not be imported."
                    );
                }

                if (
                    result.moment
                ) {
                    imported.push(
                        result.moment as
                        AtlasPinMoment
                    );
                }
            }

            if (
                imported.length > 0
            ) {
                onImported(
                    imported
                );
            }

            if (
                imported.length ===
                0 &&
                duplicateCount > 0
            ) {
                setNotice(
                    "ALL SELECTED DATES ARE ALREADY IN THIS PIN"
                );

                return;
            }

            setNotice(
                `${imported.length} MOMENT${imported.length === 1
                    ? ""
                    : "S"
                } ADDED${duplicateCount > 0
                    ? ` · ${duplicateCount} ALREADY PRESENT`
                    : ""
                }`
            );
        } catch (importError) {
            console.error(
                "Calendar Moment import failed:",
                importError
            );

            setError(
                importError instanceof Error
                    ? importError.message
                    : "Calendar dates could not be imported."
            );
        } finally {
            setIsImporting(
                false
            );
        }
    }

    return (
        <div className="atlas-calendar-importer">
            <div className="atlas-calendar-importer-heading">
                FROM CALENDAR
            </div>

            <label className="atlas-calendar-importer-field">
                <span>
                    CALENDAR
                </span>

                <select
                    value={
                        selectedCalendarId
                    }
                    onChange={(
                        event
                    ) =>
                        void chooseCalendar(
                            event.target.value
                        )
                    }
                    disabled={
                        isLoadingCalendars ||
                        isImporting
                    }
                >
                    <option value="">
                        {isLoadingCalendars
                            ? "LOADING..."
                            : "CHOOSE CALENDAR"}
                    </option>

                    {calendars.map(
                        (calendar) => (
                            <option
                                key={
                                    calendar.id
                                }
                                value={
                                    calendar.id
                                }
                            >
                                {calendar.name}
                                {calendar.primary
                                    ? " · PRIMARY"
                                    : ""}
                            </option>
                        )
                    )}
                </select>
            </label>

            {selectedCalendarId && (
                <label className="atlas-calendar-importer-field">
                    <span>
                        EVENT / SERIES
                    </span>

                    <select
                        value={
                            selectedSeriesId
                        }
                        onChange={(
                            event
                        ) =>
                            chooseSeries(
                                event.target.value
                            )
                        }
                        disabled={
                            isLoadingSeries ||
                            isImporting
                        }
                    >
                        <option value="">
                            {isLoadingSeries
                                ? "LOADING FUTURE EVENTS..."
                                : "CHOOSE EVENT"}
                        </option>

                        {series.map(
                            (item) => (
                                <option
                                    key={
                                        item.id
                                    }
                                    value={
                                        item.id
                                    }
                                >
                                    {item.title}
                                    {item.recurring
                                        ? ` · ${item.occurrenceCount} FUTURE`
                                        : ""}
                                </option>
                            )
                        )}
                    </select>
                </label>
            )}

            {selectedSeries && (
                <>
                    <div className="atlas-calendar-occurrences-header">
                        <span>
                            FUTURE DATES
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setSelectedEventIds(
                                    selectedSeries
                                        .occurrences
                                        .map(
                                            (
                                                occurrence
                                            ) =>
                                                occurrence
                                                    .eventId
                                        )
                                )
                            }
                            disabled={
                                isImporting
                            }
                        >
                            SELECT ALL
                        </button>
                    </div>

                    <div className="atlas-calendar-occurrences">
                        {selectedSeries
                            .occurrences
                            .map(
                                (
                                    occurrence
                                ) => {
                                    const selected =
                                        selectedEventIds
                                            .includes(
                                                occurrence
                                                    .eventId
                                            );

                                    return (
                                        <button
                                            key={
                                                occurrence
                                                    .eventId
                                            }
                                            type="button"
                                            className={
                                                selected
                                                    ? "is-selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                toggleOccurrence(
                                                    occurrence
                                                        .eventId
                                                )
                                            }
                                            disabled={
                                                isImporting
                                            }
                                        >
                                            <span className="atlas-calendar-occurrence-check">
                                                {selected
                                                    ? "✓"
                                                    : "○"}
                                            </span>

                                            <span>
                                                {formatOccurrence(
                                                    occurrence
                                                )}
                                            </span>
                                        </button>
                                    );
                                }
                            )}
                    </div>

                    <button
                        type="button"
                        className="atlas-calendar-import-primary"
                        onClick={() =>
                            void importSelected()
                        }
                        disabled={
                            isImporting ||
                            selectedEventIds
                                .length ===
                            0
                        }
                    >
                        {isImporting
                            ? "ADDING..."
                            : selectedEventIds
                                .length ===
                                selectedSeries
                                    .occurrences
                                    .length
                                ? "ADD ALL FUTURE DATES"
                                : `ADD ${selectedEventIds.length} SELECTED`}
                    </button>
                </>
            )}

            {notice && (
                <div className="atlas-calendar-import-notice">
                    {notice}
                </div>
            )}

            {error && (
                <div className="atlas-calendar-import-error">
                    {error}
                </div>
            )}

            <button
                type="button"
                className="atlas-calendar-import-cancel"
                onClick={
                    onCancel
                }
                disabled={
                    isImporting
                }
            >
                CANCEL
            </button>
        </div>
    );
}
