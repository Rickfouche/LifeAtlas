"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type FormEvent,
} from "react";

import AtlasGlobe from "@/components/atlas/AtlasGlobe";
import AtlasControls from "@/components/atlas/AtlasControls";
import AtlasPanel from "@/components/atlas/AtlasPanel";

import { createClient } from "@/lib/supabase/client";

import type {
    AtlasCollection,
    AtlasDraftPin,
    AtlasPin,
    AtlasPinMoment,
    AtlasPlaceSearchResult,
    AtlasTimeState,
    AtlasWorldState,
} from "@/types/atlas";

/* =========================================
   TEMPORAL MEMBERSHIP
========================================= */

function getLocalDayStart(
    value: Date
) {
    return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
    );
}

type AtlasFutureHorizon =
    | "week"
    | "month"
    | "year";

type AtlasInitialMomentInput = {
    title: string | null;
    momentType:
    | "date"
    | "datetime"
    | "range";
    startAt: string;
    endAt: string | null;
    timezone: string;
    notes: string | null;
};

function getFutureHorizonEnd(
    now: Date,
    horizon: AtlasFutureHorizon
) {
    const today =
        getLocalDayStart(now);

    if (horizon === "week") {
        const end =
            new Date(today);

        end.setDate(
            end.getDate() + 7
        );

        return end;
    }

    if (horizon === "month") {
        return new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            today.getDate()
        );
    }

    return new Date(
        today.getFullYear() + 1,
        today.getMonth(),
        today.getDate()
    );
}

function momentOverlapsFutureHorizon(
    moment: AtlasPinMoment,
    now: Date,
    horizon: AtlasFutureHorizon
) {
    const today =
        getLocalDayStart(now);

    const horizonEnd =
        getFutureHorizonEnd(
            now,
            horizon
        );

    const start =
        getLocalDayStart(
            new Date(
                moment.start_at
            )
        );

    const end =
        moment.moment_type ===
            "range" &&
            moment.end_at
            ? getLocalDayStart(
                new Date(
                    moment.end_at
                )
            )
            : start;

    /*
      Future horizons begin after today.

      Today belongs to PRESENT.
      A range that starts today but continues
      into the future may still qualify because
      part of that Moment overlaps the horizon.
    */
    return (
        end.getTime() >
        today.getTime() &&
        start.getTime() <=
        horizonEnd.getTime()
    );
}

function getMomentTimeState(
    moment: AtlasPinMoment,
    now: Date
): AtlasTimeState {
    const today =
        getLocalDayStart(now);

    const start =
        getLocalDayStart(
            new Date(
                moment.start_at
            )
        );

    if (
        moment.moment_type ===
        "range" &&
        moment.end_at
    ) {
        const end =
            getLocalDayStart(
                new Date(
                    moment.end_at
                )
            );

        if (
            today.getTime() <
            start.getTime()
        ) {
            return "future";
        }

        if (
            today.getTime() >
            end.getTime()
        ) {
            return "past";
        }

        return "present";
    }

    if (
        today.getTime() <
        start.getTime()
    ) {
        return "future";
    }

    if (
        today.getTime() >
        start.getTime()
    ) {
        return "past";
    }

    return "present";
}

const PANEL_DEFAULT_WIDTH =
    430;

const PANEL_MIN_WIDTH =
    240;

const PANEL_MAX_WIDTH =
    760;

/*
  Snap only when the handle is genuinely
  close to an edge. Everywhere else the
  released width is preserved.
*/
const PANEL_CLOSE_SNAP_ZONE =
    42;

const PANEL_OPEN_SNAP_ZONE =
    42;

type AtlasEntryStage =
    | "checking"
    | "login"
    | "verify"
    | "entering"
    | "ready";

type AtlasAuthMode =
    | "signup"
    | "login";

type AtlasAppProps = {
    initialAuthMode?: AtlasAuthMode;
};

export default function AtlasApp({
    initialAuthMode,
}: AtlasAppProps = {}) {
    /* =========================================
       SUPABASE
    ========================================= */

    const [supabase] = useState(() =>
        createClient()
    );

    /* =========================================
       CINEMATIC ENTRY

       This sits on top of the existing Atlas.
       It does not replace the Atlas UI.
    ========================================= */

    const [
        entryStage,
        setEntryStage,
    ] = useState<AtlasEntryStage>(
        initialAuthMode
            ? "login"
            : "checking"
    );

    const [
        authMode,
        setAuthMode,
    ] = useState<AtlasAuthMode>(
        initialAuthMode ??
        "signup"
    );

    const [
        authEmail,
        setAuthEmail,
    ] = useState("");

    const [
        authPassword,
        setAuthPassword,
    ] = useState("");

    const [
        authMessage,
        setAuthMessage,
    ] = useState<string | null>(
        null
    );

    const [
        isAuthBusy,
        setIsAuthBusy,
    ] = useState(false);

    const [
        atlasLoadRequestId,
        setAtlasLoadRequestId,
    ] = useState(0);

    useEffect(() => {
        /*
          /login deliberately stays on the login
          composition after email confirmation.
        */
        if (initialAuthMode) {
            return;
        }

        let cancelled =
            false;

        const resolveSession =
            async () => {
                const {
                    data: { user },
                } =
                    await supabase.auth.getUser();

                if (cancelled) {
                    return;
                }

                setEntryStage(
                    user
                        ? "ready"
                        : "login"
                );

                setAuthMode(
                    user
                        ? "login"
                        : "signup"
                );
            };

        void resolveSession();

        return () => {
            cancelled =
                true;
        };
    }, [
        initialAuthMode,
        supabase,
    ]);

    const handleAuthSubmit =
        async (
            event:
                FormEvent<HTMLFormElement>
        ) => {
            event.preventDefault();

            if (
                !authEmail.trim() ||
                !authPassword
            ) {
                setAuthMessage(
                    "Enter your email and password."
                );

                return;
            }

            setIsAuthBusy(true);
            setAuthMessage(null);

            if (
                authMode ===
                "signup"
            ) {
                const {
                    error,
                } =
                    await supabase.auth.signUp({
                        email:
                            authEmail.trim(),

                        password:
                            authPassword,

                        options: {
                            emailRedirectTo:
                                `${window.location.origin}/login`,
                        },
                    });

                setIsAuthBusy(false);

                if (error) {
                    setAuthMessage(
                        error.message
                    );

                    return;
                }

                setEntryStage(
                    "verify"
                );

                return;
            }

            const {
                error,
            } =
                await supabase.auth.signInWithPassword({
                    email:
                        authEmail.trim(),

                    password:
                        authPassword,
                });

            setIsAuthBusy(false);

            if (error) {
                setAuthMessage(
                    error.message
                );

                return;
            }

            /*
              Auth succeeds first.
              Then the same MapLibre globe pulls back.
            */

            setAtlasLoadRequestId(
                (current) =>
                    current + 1
            );

            setEntryStage(
                "entering"
            );

            window.setTimeout(
                () => {
                    setEntryStage(
                        "ready"
                    );
                },
                1900
            );
        };

    /* =========================================
       SPATIAL WORKSPACE
    ========================================= */

    const [
        panelWidth,
        setPanelWidth,
    ] = useState(0);

    const [
        isWorkspaceOpen,
        setIsWorkspaceOpen,
    ] = useState(false);

    const [
        isPanelResizing,
        setIsPanelResizing,
    ] = useState(false);

    const lastExpandedWidthRef =
        useRef(
            PANEL_DEFAULT_WIDTH
        );

    const resizeDidMoveRef =
        useRef(false);

    const dragWidthRef =
        useRef(0);

    const workspaceAnimationRef =
        useRef<number | null>(
            null
        );

    /* =========================================
       ATLAS STATE
    ========================================= */

    const [
        worldState,
        setWorldState,
    ] =
        useState<AtlasWorldState>(
            "all"
        );

    const [
        isAddingPin,
        setIsAddingPin,
    ] = useState(false);

    const [
        collections,
        setCollections,
    ] =
        useState<AtlasCollection[]>(
            []
        );

    const [
        selectedCollectionIds,
        setSelectedCollectionIds,
    ] = useState<string[]>([]);

    const [
        pins,
        setPins,
    ] =
        useState<AtlasPin[]>(
            []
        );

    const [
        pinMoments,
        setPinMoments,
    ] =
        useState<AtlasPinMoment[]>(
            []
        );

    const [
        atlasNow,
        setAtlasNow,
    ] = useState(
        () => new Date()
    );

    const [
        futureHorizon,
        setFutureHorizon,
    ] = useState<
        AtlasFutureHorizon | null
    >(null);

    const [
        sceneMode,
        setSceneMode,
    ] = useState<
        "day" | "night"
    >("night");

    const [
        draftPin,
        setDraftPin,
    ] =
        useState<AtlasDraftPin | null>(
            null
        );

    const [
        repositionPinPosition,
        setRepositionPinPosition,
    ] =
        useState<AtlasDraftPin | null>(
            null
        );

    const [
        selectedPin,
        setSelectedPin,
    ] =
        useState<AtlasPin | null>(
            null
        );

    const [
        focusPin,
        setFocusPin,
    ] =
        useState<AtlasPin | null>(
            null
        );

    const [
        focusRequestId,
        setFocusRequestId,
    ] = useState(0);

    const [
        selectedPlace,
        setSelectedPlace,
    ] =
        useState<
            AtlasPlaceSearchResult | null
        >(null);

    const [
        placeFocusRequestId,
        setPlaceFocusRequestId,
    ] = useState(0);

    const [
        isLoading,
        setIsLoading,
    ] = useState(true);

    const hasPinWorkspace =
        selectedPin !== null ||
        draftPin !== null;

    const activeWorkspaceWidth =
        isWorkspaceOpen
            ? panelWidth
            : 0;

    /* =========================================
       RIGHT WORKSPACE RESIZE

       During drag the panel follows the pointer.
       Snapping happens only on release and only
       very close to either edge.
    ========================================= */

    useEffect(() => {
        if (!isPanelResizing) {
            return;
        }

        dragWidthRef.current =
            activeWorkspaceWidth;

        const getResponsiveMax =
            () =>
                Math.min(
                    PANEL_MAX_WIDTH,
                    window.innerWidth *
                    0.58
                );

        const handlePointerMove =
            (
                event:
                    PointerEvent
            ) => {
                const responsiveMax =
                    getResponsiveMax();

                const nextWidth =
                    Math.max(
                        0,
                        Math.min(
                            responsiveMax,
                            window.innerWidth -
                            event.clientX
                        )
                    );

                if (
                    Math.abs(
                        nextWidth -
                        dragWidthRef.current
                    ) > 2
                ) {
                    resizeDidMoveRef.current =
                        true;
                }

                dragWidthRef.current =
                    nextWidth;

                setPanelWidth(
                    nextWidth
                );

                setIsWorkspaceOpen(
                    nextWidth > 0
                );
            };

        const handlePointerUp =
            () => {
                const responsiveMax =
                    getResponsiveMax();

                const releasedWidth =
                    dragWidthRef.current;

                if (
                    releasedWidth <=
                    PANEL_CLOSE_SNAP_ZONE
                ) {
                    setPanelWidth(0);

                    setIsWorkspaceOpen(
                        false
                    );

                    setIsPanelResizing(
                        false
                    );

                    return;
                }

                if (
                    releasedWidth >=
                    responsiveMax -
                    PANEL_OPEN_SNAP_ZONE
                ) {
                    setPanelWidth(
                        responsiveMax
                    );

                    lastExpandedWidthRef.current =
                        responsiveMax;

                    setIsWorkspaceOpen(
                        true
                    );

                    setIsPanelResizing(
                        false
                    );

                    return;
                }

                /*
                  Free-resize zone. Do not snap.
                  We only prevent the panel from
                  becoming unusably thin.
                */
                const settledWidth =
                    Math.max(
                        PANEL_MIN_WIDTH,
                        Math.min(
                            responsiveMax,
                            releasedWidth
                        )
                    );

                setPanelWidth(
                    settledWidth
                );

                lastExpandedWidthRef.current =
                    settledWidth;

                setIsWorkspaceOpen(
                    true
                );

                setIsPanelResizing(
                    false
                );
            };

        const previousCursor =
            document.body.style.cursor;

        const previousUserSelect =
            document.body.style.userSelect;

        document.body.style.cursor =
            "ew-resize";

        document.body.style.userSelect =
            "none";

        window.addEventListener(
            "pointermove",
            handlePointerMove
        );

        window.addEventListener(
            "pointerup",
            handlePointerUp
        );

        window.addEventListener(
            "pointercancel",
            handlePointerUp
        );

        return () => {
            window.removeEventListener(
                "pointermove",
                handlePointerMove
            );

            window.removeEventListener(
                "pointerup",
                handlePointerUp
            );

            window.removeEventListener(
                "pointercancel",
                handlePointerUp
            );

            document.body.style.cursor =
                previousCursor;

            document.body.style.userSelect =
                previousUserSelect;
        };
    }, [
        isPanelResizing,
        activeWorkspaceWidth,
    ]);

    /* =========================================
       WORKSPACE MOTION
    ========================================= */

    const animateWorkspaceTo =
        useCallback(
            (
                targetWidth: number,
                onComplete?: () => void
            ) => {
                if (
                    workspaceAnimationRef.current !==
                    null
                ) {
                    cancelAnimationFrame(
                        workspaceAnimationRef.current
                    );
                }

                const startWidth =
                    panelWidth;

                const distance =
                    targetWidth -
                    startWidth;

                const duration =
                    360;

                const startedAt =
                    performance.now();

                const tick =
                    (now: number) => {
                        const progress =
                            Math.min(
                                1,
                                (now -
                                    startedAt) /
                                duration
                            );

                        const eased =
                            1 -
                            Math.pow(
                                1 - progress,
                                3
                            );

                        setPanelWidth(
                            startWidth +
                            distance *
                            eased
                        );

                        if (
                            progress < 1
                        ) {
                            workspaceAnimationRef.current =
                                requestAnimationFrame(
                                    tick
                                );

                            return;
                        }

                        workspaceAnimationRef.current =
                            null;

                        setPanelWidth(
                            targetWidth
                        );

                        onComplete?.();
                    };

                workspaceAnimationRef.current =
                    requestAnimationFrame(
                        tick
                    );
            },
            [panelWidth]
        );

    useEffect(() => {
        return () => {
            if (
                workspaceAnimationRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    workspaceAnimationRef.current
                );
            }
        };
    }, []);

    /* =========================================
       QUICK OPEN / COLLAPSE
    ========================================= */

    const handleToggleWorkspace =
        () => {
            if (
                resizeDidMoveRef.current
            ) {
                resizeDidMoveRef.current =
                    false;

                return;
            }

            if (isWorkspaceOpen) {
                if (
                    panelWidth >=
                    PANEL_MIN_WIDTH
                ) {
                    lastExpandedWidthRef.current =
                        panelWidth;
                }

                animateWorkspaceTo(
                    0,
                    () => {
                        setIsWorkspaceOpen(
                            false
                        );
                    }
                );

                return;
            }

            const responsiveMax =
                Math.min(
                    PANEL_MAX_WIDTH,
                    window.innerWidth *
                    0.55
                );

            const restoredWidth =
                Math.min(
                    responsiveMax,
                    Math.max(
                        PANEL_MIN_WIDTH,
                        lastExpandedWidthRef.current
                    )
                );

            setIsWorkspaceOpen(
                true
            );

            animateWorkspaceTo(
                restoredWidth
            );
        };

    /* =========================================
       KEEP PANEL WIDTH VALID ON WINDOW RESIZE
    ========================================= */

    useEffect(() => {
        const handleWindowResize =
            () => {
                const responsiveMax =
                    Math.min(
                        PANEL_MAX_WIDTH,
                        window.innerWidth *
                        0.55
                    );

                setPanelWidth(
                    (current) => {
                        if (
                            current <= 0
                        ) {
                            return 0;
                        }

                        return Math.max(
                            PANEL_MIN_WIDTH,
                            Math.min(
                                responsiveMax,
                                current
                            )
                        );
                    }
                );
            };

        window.addEventListener(
            "resize",
            handleWindowResize
        );

        return () => {
            window.removeEventListener(
                "resize",
                handleWindowResize
            );
        };
    }, []);

    /* =========================================
       ATLAS CLOCK

       Keeps globe membership current when
       a day changes while Atlas is open.
    ========================================= */

    useEffect(() => {
        const interval =
            window.setInterval(
                () => {
                    setAtlasNow(
                        new Date()
                    );
                },
                60 * 1000
            );

        return () => {
            window.clearInterval(
                interval
            );
        };
    }, []);

    /* =========================================
       LOAD ATLAS FROM SUPABASE
    ========================================= */

    useEffect(() => {
        const loadAtlas =
            async () => {
                setIsLoading(true);

                /* -------------------------------------
                   GET CURRENT USER
                ------------------------------------- */

                const {
                    data: { user },
                    error: userError,
                } =
                    await supabase.auth.getUser();

                if (userError) {
                    console.error(
                        "Could not get Atlas user:",
                        userError
                    );

                    setIsLoading(false);

                    return;
                }

                if (!user) {
                    setIsLoading(false);

                    return;
                }

                /* -------------------------------------
                   LOAD COLLECTIONS
                ------------------------------------- */

                const {
                    data:
                    collectionRows,
                    error:
                    collectionsError,
                } = await supabase
                    .from(
                        "collections"
                    )
                    .select(
                        "id, name"
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true,
                        }
                    );

                if (
                    collectionsError
                ) {
                    console.error(
                        "Could not load collections:",
                        collectionsError
                    );
                } else {
                    setCollections(
                        (
                            collectionRows ??
                            []
                        ).map(
                            (
                                collection
                            ) => ({
                                id:
                                    collection.id,

                                name:
                                    collection.name,
                            })
                        )
                    );
                }

                /* -------------------------------------
                   LOAD PINS
                ------------------------------------- */

                const {
                    data: pinRows,
                    error: pinsError,
                } = await supabase
                    .from("pins")
                    .select(`
            id,
            title,
            latitude,
            longitude,
            time_state,
            description,
            notes,
            place_provider,
            external_place_id,
            formatted_address,
            place_type,
            cover_media_id,
            pin_collections (
              collection_id
            )
          `)
                    .order(
                        "created_at",
                        {
                            ascending: true,
                        }
                    );

                if (pinsError) {
                    console.error(
                        "Could not load pins:",
                        pinsError
                    );

                    setIsLoading(false);

                    return;
                }

                /* -------------------------------------
                   RESOLVE OPTIONAL PIN COVER IMAGES

                   The Pin stores only cover_media_id.
                   For globe hover, resolve those Bunny
                   media rows into display URLs once.
                ------------------------------------- */

                const coverMediaIds =
                    Array.from(
                        new Set(
                            (
                                pinRows ?? []
                            )
                                .map(
                                    (pin) =>
                                        pin.cover_media_id
                                )
                                .filter(
                                    (
                                        id
                                    ): id is string =>
                                        Boolean(id)
                                )
                        )
                    );

                const coverImageUrlById =
                    new Map<
                        string,
                        string
                    >();

                if (
                    coverMediaIds.length >
                    0
                ) {
                    const {
                        data:
                        coverMediaRows,
                        error:
                        coverMediaError,
                    } = await supabase
                        .from("media")
                        .select(`
                          id,
                          storage_path
                        `)
                        .in(
                            "id",
                            coverMediaIds
                        );

                    if (
                        coverMediaError
                    ) {
                        console.error(
                            "Could not load Pin cover images:",
                            coverMediaError
                        );
                    } else {
                        const bunnyCdnUrl =
                            process.env
                                .NEXT_PUBLIC_BUNNY_CDN_URL
                                ?.replace(
                                    /\/$/,
                                    ""
                                ) ??
                            "";

                        (
                            coverMediaRows ??
                            []
                        ).forEach(
                            (media) => {
                                if (
                                    !media.storage_path ||
                                    !bunnyCdnUrl
                                ) {
                                    return;
                                }

                                coverImageUrlById.set(
                                    media.id,
                                    `${bunnyCdnUrl}/${media.storage_path}`
                                );
                            }
                        );
                    }
                }

                /* -------------------------------------
                   DATABASE → ATLAS
                ------------------------------------- */

                const loadedPins:
                    AtlasPin[] =
                    (
                        pinRows ?? []
                    ).map(
                        (pin) => ({
                            id: pin.id,

                            title:
                                pin.title,

                            latitude:
                                pin.latitude,

                            longitude:
                                pin.longitude,

                            timeState:
                                pin.time_state as AtlasTimeState,

                            collectionIds:
                                pin.pin_collections?.map(
                                    (
                                        relationship
                                    ) =>
                                        relationship.collection_id
                                ) ?? [],

                            description:
                                pin.description ??
                                undefined,

                            notes:
                                pin.notes ??
                                undefined,

                            placeProvider:
                                pin.place_provider ===
                                    "google"
                                    ? "google"
                                    : undefined,

                            externalPlaceId:
                                pin.external_place_id ??
                                undefined,

                            formattedAddress:
                                pin.formatted_address ??
                                undefined,

                            placeType:
                                pin.place_type ??
                                undefined,

                            coverMediaId:
                                pin.cover_media_id ??
                                null,

                            coverImageUrl:
                                pin.cover_media_id
                                    ? coverImageUrlById.get(
                                        pin.cover_media_id
                                    ) ??
                                    null
                                    : null,
                        })
                    );

                setPins(
                    loadedPins
                );

                /* -------------------------------------
                   LOAD PIN MOMENTS

                   These give the globe retroactive
                   PAST / PRESENT / FUTURE membership.
                ------------------------------------- */

                const {
                    data:
                    momentRows,
                    error:
                    momentsError,
                } = await supabase
                    .from(
                        "pin_moments"
                    )
                    .select(`
            id,
            pin_id,
            title,
            moment_type,
            start_at,
            end_at,
            timezone,
            notes,
            metadata,
            created_at,
            updated_at
          `)
                    .order(
                        "start_at",
                        {
                            ascending: true,
                        }
                    );

                if (
                    momentsError
                ) {
                    console.error(
                        "Could not load pin moments:",
                        momentsError
                    );

                    setPinMoments(
                        []
                    );
                } else {
                    setPinMoments(
                        (
                            momentRows ??
                            []
                        ) as AtlasPinMoment[]
                    );
                }

                setIsLoading(
                    false
                );
            };

        void loadAtlas();
    }, [
        supabase,
        atlasLoadRequestId,
    ]);

    /* =========================================
       DEFAULT PIN STATE
    ========================================= */

    const getDefaultTimeState =
        (): AtlasTimeState => {
            if (
                worldState ===
                "past"
            ) {
                return "past";
            }

            if (
                worldState ===
                "future"
            ) {
                return "future";
            }

            return "present";
        };

    /* =========================================
       OPEN WORKSPACE FOR PIN
    ========================================= */

    const openWorkspaceForPin =
        useCallback(() => {
            if (isWorkspaceOpen) {
                return;
            }

            const responsiveMax =
                Math.min(
                    PANEL_MAX_WIDTH,
                    window.innerWidth *
                    0.55
                );

            const restoredWidth =
                Math.min(
                    responsiveMax,
                    Math.max(
                        PANEL_MIN_WIDTH,
                        lastExpandedWidthRef.current
                    )
                );

            setIsWorkspaceOpen(
                true
            );

            animateWorkspaceTo(
                restoredWidth
            );
        }, [
            isWorkspaceOpen,
            animateWorkspaceTo,
        ]);

    /* =========================================
       CREATE DRAFT PIN
    ========================================= */

    const handleCreateDraftPin =
        useCallback(
            (
                pin:
                    AtlasDraftPin
            ) => {
                /*
                  Creating something new
                  closes any existing pin.
                */

                openWorkspaceForPin();

                setRepositionPinPosition(
                    null
                );

                setSelectedPin(
                    null
                );

                setSelectedPlace(
                    null
                );

                setDraftPin(pin);
            },
            [
                openWorkspaceForPin,
            ]
        );

    /* =========================================
       GOOGLE PLACE TARGET
    ========================================= */

    const handleSelectPlace =
        useCallback(
            (
                place:
                    AtlasPlaceSearchResult
            ) => {
                setSelectedPlace(
                    place
                );

                setSelectedPin(
                    null
                );

                setDraftPin(
                    null
                );

                setIsAddingPin(
                    false
                );

                setPlaceFocusRequestId(
                    (current) =>
                        current + 1
                );
            },
            []
        );

    const handleAddSelectedPlace =
        useCallback(() => {
            if (!selectedPlace) {
                return;
            }

            openWorkspaceForPin();

            setSelectedPin(
                null
            );

            setIsAddingPin(
                false
            );

            setDraftPin({
                latitude:
                    selectedPlace.latitude,

                longitude:
                    selectedPlace.longitude,

                title:
                    selectedPlace.name,

                placeProvider:
                    "google",

                externalPlaceId:
                    selectedPlace.id,

                formattedAddress:
                    selectedPlace.formattedAddress,

                placeType:
                    selectedPlace.primaryType ??
                    undefined,
            });

            setSelectedPlace(
                null
            );
        }, [
            selectedPlace,
            openWorkspaceForPin,
        ]);

    /* =========================================
       SELECT SAVED PIN
    ========================================= */

    const handleSelectPin =
        useCallback(
            (pin: AtlasPin) => {
                /*
                  Selecting an existing pin
                  exits placement mode.
                */

                openWorkspaceForPin();

                setIsAddingPin(
                    false
                );

                setRepositionPinPosition(
                    null
                );

                setDraftPin(
                    null
                );

                setSelectedPlace(
                    null
                );

                setSelectedPin(
                    pin
                );
            },
            [
                openWorkspaceForPin,
            ]
        );

    /* =========================================
       CLOSE PANEL
    ========================================= */

    const handleClosePanel =
        () => {
            setDraftPin(
                null
            );

            setRepositionPinPosition(
                null
            );

            setSelectedPin(
                null
            );
        };

    /*
      Mobile uses a decisive full close:
      clear the pin context AND collapse the
      workspace so the globe immediately becomes
      the active surface again.

      Desktop continues using handleClosePanel()
      exactly as before.
    */
    const handleMobileCloseWorkspace =
        () => {
            if (
                workspaceAnimationRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    workspaceAnimationRef.current
                );

                workspaceAnimationRef.current =
                    null;
            }

            setDraftPin(
                null
            );

            setRepositionPinPosition(
                null
            );

            setSelectedPin(
                null
            );

            setPanelWidth(
                0
            );

            setIsWorkspaceOpen(
                false
            );

            setIsPanelResizing(
                false
            );
        };

    /* =========================================
       CREATE COLLECTION
    ========================================= */

    const handleCreateCollection =
        async (
            name: string
        ) => {
            const trimmedName =
                name.trim();

            if (!trimmedName) {
                return;
            }

            const {
                data: { user },
                error: userError,
            } =
                await supabase.auth.getUser();

            if (
                userError ||
                !user
            ) {
                console.error(
                    "Cannot create collection:",
                    userError
                );

                return;
            }

            /* -------------------------------------
               PREVENT LOCAL DUPLICATES
            ------------------------------------- */

            const alreadyExists =
                collections.some(
                    (
                        collection
                    ) =>
                        collection.name
                            .trim()
                            .toLowerCase() ===
                        trimmedName.toLowerCase()
                );

            if (
                alreadyExists
            ) {
                console.warn(
                    "Collection already exists:",
                    trimmedName
                );

                return;
            }

            /* -------------------------------------
               SAVE COLLECTION
            ------------------------------------- */

            const {
                data:
                savedCollection,
                error:
                collectionError,
            } = await supabase
                .from(
                    "collections"
                )
                .insert({
                    user_id:
                        user.id,

                    name:
                        trimmedName,
                })
                .select(
                    "id, name"
                )
                .single();

            if (
                collectionError ||
                !savedCollection
            ) {
                console.error(
                    "Could not create collection:",
                    collectionError
                );

                return;
            }

            const atlasCollection:
                AtlasCollection = {
                id:
                    savedCollection.id,

                name:
                    savedCollection.name,
            };

            setCollections(
                (current) => [
                    ...current,
                    atlasCollection,
                ]
            );
        };

    /* =========================================
       RENAME COLLECTION
    ========================================= */

    const handleRenameCollection =
        async (
            collectionId: string,
            name: string
        ) => {
            const trimmedName =
                name.trim();

            if (!trimmedName) {
                throw new Error(
                    "Collection name is required."
                );
            }

            const duplicate =
                collections.some(
                    (collection) =>
                        collection.id !==
                        collectionId &&
                        collection.name
                            .trim()
                            .toLowerCase() ===
                        trimmedName.toLowerCase()
                );

            if (duplicate) {
                throw new Error(
                    "A Collection with that name already exists."
                );
            }

            const {
                data: updatedCollection,
                error: updateError,
            } = await supabase
                .from("collections")
                .update({
                    name:
                        trimmedName,
                })
                .eq(
                    "id",
                    collectionId
                )
                .select(
                    "id, name"
                )
                .single();

            if (
                updateError ||
                !updatedCollection
            ) {
                console.error(
                    "Could not rename collection:",
                    updateError
                );

                throw new Error(
                    "Could not rename Collection."
                );
            }

            setCollections(
                (current) =>
                    current.map(
                        (collection) =>
                            collection.id ===
                                collectionId
                                ? {
                                    id:
                                        updatedCollection.id,
                                    name:
                                        updatedCollection.name,
                                }
                                : collection
                    )
            );
        };

    /* =========================================
       DELETE COLLECTION

       Deletes the life-path container only.
       Pins, Moments, People and Content survive.
       FK cascades remove relationship rows.
    ========================================= */

    const handleDeleteCollection =
        async (
            collectionId: string
        ) => {
            const {
                error: deleteError,
            } = await supabase
                .from("collections")
                .delete()
                .eq(
                    "id",
                    collectionId
                );

            if (deleteError) {
                console.error(
                    "Could not delete collection:",
                    deleteError
                );

                throw new Error(
                    "Could not delete Collection."
                );
            }

            setCollections(
                (current) =>
                    current.filter(
                        (collection) =>
                            collection.id !==
                            collectionId
                    )
            );

            setSelectedCollectionIds(
                (current) =>
                    current.filter(
                        (id) =>
                            id !==
                            collectionId
                    )
            );

            setPins(
                (current) =>
                    current.map(
                        (pin) => ({
                            ...pin,
                            collectionIds:
                                pin.collectionIds.filter(
                                    (id) =>
                                        id !==
                                        collectionId
                                ),
                        }))
            );

            setSelectedPin(
                (current) =>
                    current
                        ? {
                            ...current,
                            collectionIds:
                                current.collectionIds.filter(
                                    (id) =>
                                        id !==
                                        collectionId
                                ),
                        }
                        : null
            );
        };

    /* =========================================
       COLLECTION PIN NAVIGATION
    ========================================= */

    const handleNavigateToPin =
        (
            pin: AtlasPin
        ) => {
            handleSelectPin(
                pin
            );

            setFocusPin(
                pin
            );

            setFocusRequestId(
                (current) =>
                    current + 1
            );
        };

    /* =========================================
       COLLECTION FILTERING
    ========================================= */

    const handleToggleCollection =
        (
            collectionId:
                string
        ) => {
            setSelectedCollectionIds(
                (current) => {
                    /*
                      COLLECTION FOCUS

                      A Collection is a persistent lens,
                      not a toggle.

                      Clicking the active Collection again
                      leaves it selected. The Collection
                      changes only when another Collection
                      is chosen or ALL explicitly clears
                      Collection filtering.
                    */

                    if (
                        current[0] ===
                        collectionId
                    ) {
                        return current;
                    }

                    return [
                        collectionId,
                    ];
                }
            );
        };

    const handleClearCollections =
        () => {
            setSelectedCollectionIds(
                []
            );
        };

    /* =========================================
       SAVE NEW PIN
    ========================================= */

    const handleSavePin =
        async (
            pin: AtlasPin,
            initialMoment:
                AtlasInitialMomentInput | null =
                null
        ): Promise<AtlasPin | void> => {
            const {
                data: { user },
                error: userError,
            } =
                await supabase.auth.getUser();

            if (
                userError ||
                !user
            ) {
                console.error(
                    "Cannot save pin without authenticated user:",
                    userError
                );

                return;
            }

            /* -------------------------------------
               CREATE PIN
            ------------------------------------- */

            const {
                data: savedPin,
                error: pinError,
            } = await supabase
                .from("pins")
                .insert({
                    user_id:
                        user.id,

                    title:
                        pin.title,

                    latitude:
                        pin.latitude,

                    longitude:
                        pin.longitude,

                    time_state:
                        pin.timeState,

                    description:
                        pin.description ??
                        null,

                    place_provider:
                        pin.placeProvider ??
                        null,

                    external_place_id:
                        pin.externalPlaceId ??
                        null,

                    formatted_address:
                        pin.formattedAddress ??
                        null,

                    place_type:
                        pin.placeType ??
                        null,
                })
                .select(`
          id,
          title,
          latitude,
          longitude,
          time_state,
          description,
          notes,
          place_provider,
          external_place_id,
          formatted_address,
          place_type,
          cover_media_id
        `)
                .single();

            if (
                pinError ||
                !savedPin
            ) {
                console.error(
                    "Could not save pin:",
                    pinError
                );

                return;
            }

            /* -------------------------------------
               SAVE COLLECTION RELATIONSHIPS
            ------------------------------------- */

            if (
                pin.collectionIds
                    .length > 0
            ) {
                const relationshipRows =
                    pin.collectionIds.map(
                        (
                            collectionId
                        ) => ({
                            pin_id:
                                savedPin.id,

                            collection_id:
                                collectionId,

                            user_id:
                                user.id,
                        })
                    );

                const {
                    error:
                    relationshipError,
                } = await supabase
                    .from(
                        "pin_collections"
                    )
                    .insert(
                        relationshipRows
                    );

                if (
                    relationshipError
                ) {
                    console.error(
                        "Could not save pin collections:",
                        relationshipError
                    );

                    await supabase
                        .from("pins")
                        .delete()
                        .eq(
                            "id",
                            savedPin.id
                        );

                    return;
                }
            }

            /* -------------------------------------
               DATABASE → ATLAS
            ------------------------------------- */

            const atlasPin:
                AtlasPin = {
                id:
                    savedPin.id,

                title:
                    savedPin.title,

                latitude:
                    savedPin.latitude,

                longitude:
                    savedPin.longitude,

                timeState:
                    savedPin.time_state as AtlasTimeState,

                collectionIds:
                    pin.collectionIds,

                description:
                    savedPin.description ??
                    undefined,

                notes:
                    savedPin.notes ??
                    undefined,

                placeProvider:
                    savedPin.place_provider ===
                        "google"
                        ? "google"
                        : undefined,

                externalPlaceId:
                    savedPin.external_place_id ??
                    undefined,

                formattedAddress:
                    savedPin.formatted_address ??
                    undefined,

                placeType:
                    savedPin.place_type ??
                    undefined,

                coverMediaId:
                    savedPin.cover_media_id ??
                    null,

                coverImageUrl:
                    null,
            };

            /* -------------------------------------
               OPTIONAL FIRST MOMENT

               A new Pin can be planted with its
               first dated Moment in the same save.
               The Pin remains the parent object.
            ------------------------------------- */

            let createdMoment:
                AtlasPinMoment | null =
                null;

            if (initialMoment) {
                try {
                    const momentResponse =
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
                                        pinId:
                                            atlasPin.id,

                                        title:
                                            initialMoment.title,

                                        momentType:
                                            initialMoment.momentType,

                                        startAt:
                                            initialMoment.startAt,

                                        endAt:
                                            initialMoment.endAt,

                                        timezone:
                                            initialMoment.timezone,

                                        notes:
                                            initialMoment.notes,
                                    }),
                            }
                        );

                    const momentResult =
                        await momentResponse.json();

                    if (
                        !momentResponse.ok
                    ) {
                        throw new Error(
                            momentResult.error ??
                            "Could not save first Moment."
                        );
                    }

                    createdMoment =
                        momentResult.moment as
                        AtlasPinMoment;
                } catch (error) {
                    console.error(
                        "Could not create first Pin Moment:",
                        error
                    );

                    /*
                      The Pin itself has already been saved.
                      Keep it instead of deleting a valid
                      life object because its optional Moment
                      failed.
                    */
                }
            }

            setPins(
                (current) => [
                    ...current,
                    atlasPin,
                ]
            );

            if (createdMoment) {
                setPinMoments(
                    (current) => [
                        ...current,
                        createdMoment as
                        AtlasPinMoment,
                    ]
                );
            }

            /*
              Planting is a transition, not an exit.
              The draft becomes the real saved Pin and
              the existing workspace stays open.
            */

            setDraftPin(
                null
            );

            setSelectedPin(
                atlasPin
            );

            return atlasPin;
        };

    /* =========================================
       REPOSITION EXISTING PIN

       The Pin stays the same object.
       Only latitude / longitude are previewed
       and persisted.
    ========================================= */

    const handleStartRepositionPin =
        useCallback(() => {
            if (!selectedPin) {
                return;
            }

            setIsAddingPin(
                false
            );

            setSelectedPlace(
                null
            );

            setDraftPin(
                null
            );

            setRepositionPinPosition({
                latitude:
                    selectedPin.latitude,

                longitude:
                    selectedPin.longitude,
            });

            setFocusPin(
                selectedPin
            );

            setFocusRequestId(
                (current) =>
                    current + 1
            );
        }, [
            selectedPin,
        ]);


    const handlePreviewRepositionPin =
        useCallback(
            (
                position:
                    AtlasDraftPin
            ) => {
                setRepositionPinPosition(
                    (current) =>
                        current
                            ? {
                                ...current,

                                latitude:
                                    position.latitude,

                                longitude:
                                    position.longitude,
                            }
                            : current
                );
            },
            []
        );


    const handleCancelRepositionPin =
        useCallback(() => {
            setRepositionPinPosition(
                null
            );
        }, []);


    const handleSaveRepositionPin =
        useCallback(
            async () => {
                if (
                    !selectedPin ||
                    !repositionPinPosition
                ) {
                    return;
                }

                const {
                    error,
                } = await supabase
                    .from("pins")
                    .update({
                        latitude:
                            repositionPinPosition.latitude,

                        longitude:
                            repositionPinPosition.longitude,

                        updated_at:
                            new Date().toISOString(),
                    })
                    .eq(
                        "id",
                        selectedPin.id
                    );

                if (error) {
                    console.error(
                        "Could not reposition pin:",
                        error
                    );

                    throw new Error(
                        "Could not save Pin position."
                    );
                }

                const updatedPin:
                    AtlasPin = {
                    ...selectedPin,

                    latitude:
                        repositionPinPosition.latitude,

                    longitude:
                        repositionPinPosition.longitude,
                };

                setPins(
                    (current) =>
                        current.map(
                            (pin) =>
                                pin.id ===
                                    updatedPin.id
                                    ? updatedPin
                                    : pin
                        )
                );

                setSelectedPin(
                    updatedPin
                );

                setRepositionPinPosition(
                    null
                );

                setFocusPin(
                    updatedPin
                );

                setFocusRequestId(
                    (current) =>
                        current + 1
                );
            },
            [
                repositionPinPosition,
                selectedPin,
                supabase,
            ]
        );


    /* =========================================
       UPDATE EXISTING PIN
    ========================================= */

    const handleUpdatePin =
        async (
            pin: AtlasPin
        ) => {
            const {
                data: { user },
                error: userError,
            } =
                await supabase.auth.getUser();

            if (
                userError ||
                !user
            ) {
                console.error(
                    "Cannot update pin without authenticated user:",
                    userError
                );

                return;
            }

            /* -------------------------------------
               UPDATE CORE PIN DATA
            ------------------------------------- */

            const {
                error: updateError,
            } = await supabase
                .from("pins")
                .update({
                    title:
                        pin.title,

                    time_state:
                        pin.timeState,

                    description:
                        pin.description ??
                        null,

                    place_provider:
                        pin.placeProvider ??
                        null,

                    external_place_id:
                        pin.externalPlaceId ??
                        null,

                    formatted_address:
                        pin.formattedAddress ??
                        null,

                    place_type:
                        pin.placeType ??
                        null,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    pin.id
                );

            if (updateError) {
                console.error(
                    "Could not update pin:",
                    updateError
                );

                return;
            }

            /* -------------------------------------
               RESET OLD COLLECTION RELATIONSHIPS
            ------------------------------------- */

            const {
                error:
                deleteRelationshipsError,
            } = await supabase
                .from(
                    "pin_collections"
                )
                .delete()
                .eq(
                    "pin_id",
                    pin.id
                );

            if (
                deleteRelationshipsError
            ) {
                console.error(
                    "Could not reset pin collections:",
                    deleteRelationshipsError
                );

                return;
            }

            /* -------------------------------------
               CREATE CURRENT RELATIONSHIPS
            ------------------------------------- */

            if (
                pin.collectionIds
                    .length > 0
            ) {
                const relationshipRows =
                    pin.collectionIds.map(
                        (
                            collectionId
                        ) => ({
                            pin_id:
                                pin.id,

                            collection_id:
                                collectionId,

                            user_id:
                                user.id,
                        })
                    );

                const {
                    error:
                    relationshipError,
                } = await supabase
                    .from(
                        "pin_collections"
                    )
                    .insert(
                        relationshipRows
                    );

                if (
                    relationshipError
                ) {
                    console.error(
                        "Could not update pin collections:",
                        relationshipError
                    );

                    return;
                }
            }

            /* -------------------------------------
               UPDATE LOCAL ATLAS
            ------------------------------------- */

            setPins(
                (current) =>
                    current.map(
                        (
                            currentPin
                        ) =>
                            currentPin.id ===
                                pin.id
                                ? pin
                                : currentPin
                    )
            );

            setSelectedPin(
                null
            );
        };

    /* =========================================
       PIN COVER IMAGE
    ========================================= */

    const handlePinCoverChange =
        async (
            pinId: string,
            coverMediaId: string | null,
            coverImageUrl:
                string | null =
                null
        ) => {
            const {
                error,
            } = await supabase
                .from("pins")
                .update({
                    cover_media_id:
                        coverMediaId,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    pinId
                );

            if (error) {
                console.error(
                    "Could not update Pin cover image:",
                    error
                );

                throw new Error(
                    "Could not update Pin image."
                );
            }

            setPins(
                (current) =>
                    current.map(
                        (pin) =>
                            pin.id ===
                                pinId
                                ? {
                                    ...pin,
                                    coverMediaId,
                                    coverImageUrl,
                                }
                                : pin
                    )
            );

            setSelectedPin(
                (current) =>
                    current?.id ===
                        pinId
                        ? {
                            ...current,
                            coverMediaId,
                            coverImageUrl,
                        }
                        : current
            );
        };

    /* =========================================
       MOMENTS CHANGED

       AtlasPanel owns moment editing.
       The App owns global world membership.
    ========================================= */

    const handleMomentsChange =
        (
            pinId: string,
            nextMoments:
                AtlasPinMoment[]
        ) => {
            setPinMoments(
                (current) => [
                    ...current.filter(
                        (moment) =>
                            moment.pin_id !==
                            pinId
                    ),
                    ...nextMoments,
                ]
            );
        };

    /* =========================================
       DELETE EXISTING PIN
    ========================================= */

    const handleDeletePin =
        async (
            pinId: string
        ) => {
            /*
              pin_collections rows are
              ON DELETE CASCADE, so deleting
              the pin removes those relationships.
            */

            const {
                error:
                deleteError,
            } = await supabase
                .from("pins")
                .delete()
                .eq(
                    "id",
                    pinId
                );

            if (deleteError) {
                console.error(
                    "Could not delete pin:",
                    deleteError
                );

                return;
            }

            setPins(
                (current) =>
                    current.filter(
                        (pin) =>
                            pin.id !==
                            pinId
                    )
            );

            setPinMoments(
                (current) =>
                    current.filter(
                        (moment) =>
                            moment.pin_id !==
                            pinId
                    )
            );

            setSelectedPin(
                null
            );

            setDraftPin(
                null
            );
        };

    /* =========================================
       WORLD + COLLECTION FILTERING
    ========================================= */

    const visiblePins =
        pins.filter(
            (pin) => {
                /*
                  WORLD TIME

                  A pin always keeps its manual /
                  conceptual state.

                  Every dated Moment adds another
                  temporal membership to the same
                  physical pin.
                */

                const momentStates =
                    pinMoments
                        .filter(
                            (moment) =>
                                moment.pin_id ===
                                pin.id
                        )
                        .map(
                            (moment) =>
                                getMomentTimeState(
                                    moment,
                                    atlasNow
                                )
                        );

                const effectiveStates =
                    new Set<
                        AtlasTimeState
                    >([
                        pin.timeState,
                        ...momentStates,
                    ]);

                let matchesTime =
                    worldState ===
                    "all" ||
                    effectiveStates.has(
                        worldState as
                        AtlasTimeState
                    );

                /*
                  FUTURE HORIZONS

                  FUTURE with no horizon keeps the broad
                  conceptual view: undated Future Pins
                  plus any Pins with Future Moments.

                  WEEK / MONTH / YEAR become schedule lenses:
                  they surface only parent Pins whose dated
                  Moments overlap that forward window.
                */
                if (
                    worldState ===
                    "future" &&
                    futureHorizon
                ) {
                    matchesTime =
                        pinMoments
                            .filter(
                                (moment) =>
                                    moment.pin_id ===
                                    pin.id
                            )
                            .some(
                                (moment) =>
                                    momentOverlapsFutureHorizon(
                                        moment,
                                        atlasNow,
                                        futureHorizon
                                    )
                            );
                }

                /* COLLECTIONS */

                const activeCollectionId =
                    selectedCollectionIds[0] ??
                    null;

                const matchesCollections =
                    activeCollectionId ===
                    null ||
                    pin.collectionIds.includes(
                        activeCollectionId
                    );

                return (
                    matchesTime &&
                    matchesCollections
                );
            }
        );

    /* =========================================
       ATLAS
    ========================================= */

    return (
        <main
            className={`atlas atlas--${sceneMode} atlas--world-${worldState} atlas--entry-${entryStage} ${isAddingPin ||
                repositionPinPosition
                ? "atlas--add-mode"
                : ""
                } ${isPanelResizing
                    ? "atlas--panel-resizing"
                    : ""
                }`}
            data-loading={
                isLoading
                    ? "true"
                    : "false"
            }
            style={
                {
                    "--atlas-panel-width":
                        `${activeWorkspaceWidth}px`,
                } as CSSProperties
            }
        >
            {/* PRESENT + PAST + FUTURE SCENE BACKDROPS */}

            <div
                className="atlas-scene-backdrop atlas-scene-backdrop--present-night"
                aria-hidden="true"
            />

            <div
                className="atlas-scene-backdrop atlas-scene-backdrop--present-day"
                aria-hidden="true"
            />

            <div
                className="atlas-scene-backdrop atlas-scene-backdrop--past-night"
                aria-hidden="true"
            />

            <div
                className="atlas-scene-backdrop atlas-scene-backdrop--past-day"
                aria-hidden="true"
            />

            <div
                className="atlas-scene-backdrop atlas-scene-backdrop--future-night"
                aria-hidden="true"
            />

            <div
                className="atlas-scene-backdrop atlas-scene-backdrop--future-day"
                aria-hidden="true"
            />

            {/* GLOBE */}

            <section className="atlas-viewport">
                <AtlasGlobe
                    worldState={
                        worldState
                    }

                    sceneMode={
                        sceneMode
                    }

                    entryStage={
                        entryStage
                    }

                    isAddingPin={
                        isAddingPin
                    }

                    isRepositioningPin={
                        repositionPinPosition !==
                        null
                    }

                    repositioningPinId={
                        repositionPinPosition &&
                            selectedPin
                            ? selectedPin.id
                            : null
                    }

                    repositionPin={
                        repositionPinPosition
                    }

                    pins={
                        visiblePins
                    }

                    draftPin={
                        draftPin
                    }

                    workspaceRightInset={
                        activeWorkspaceWidth
                    }

                    visualCenterYOffset={
                        36
                    }

                    focusPin={
                        focusPin
                    }

                    focusRequestId={
                        focusRequestId
                    }

                    previewPlace={
                        selectedPlace
                    }

                    previewPlaceRequestId={
                        placeFocusRequestId
                    }

                    onCreateDraftPin={
                        handleCreateDraftPin
                    }

                    onRepositionPin={
                        handlePreviewRepositionPin
                    }

                    onSelectPin={
                        handleSelectPin
                    }
                />
            </section>

            {/* =====================================
                LOGIN / TITLE COMPOSITION

                This LIFE ATLAS is intentionally
                separate from the application brand.
            ====================================== */}

            <section
                className="atlas-entry-card"
                aria-hidden={
                    entryStage ===
                    "ready"
                }
            >
                <div className="atlas-entry-kicker">
                    EARLY ACCESS
                </div>

                <h1 className="atlas-entry-title">
                    LIFE ATLAS
                </h1>

                <p className="atlas-entry-tagline">
                    Save your past.
                    <br />
                    Map your present.
                    <br />
                    Connect your future.
                </p>

                {entryStage ===
                    "verify" ? (
                    <div className="atlas-entry-verify">
                        <div className="atlas-entry-verify-title">
                            CHECK YOUR EMAIL
                        </div>

                        <p>
                            A verification link
                            was sent to{" "}
                            <strong>
                                {authEmail}
                            </strong>
                            .
                        </p>

                        <p>
                            Open it, return here,
                            then enter your
                            credentials.
                        </p>

                        <button
                            type="button"
                            className="atlas-entry-secondary"
                            onClick={() => {
                                setAuthMode(
                                    "login"
                                );

                                setEntryStage(
                                    "login"
                                );

                                setAuthMessage(
                                    null
                                );
                            }}
                        >
                            BACK TO LOGIN
                        </button>
                    </div>
                ) : (
                    <form
                        className="atlas-entry-form"
                        onSubmit={
                            handleAuthSubmit
                        }
                    >
                        <label>
                            <span>
                                EMAIL
                            </span>

                            <input
                                type="email"
                                autoComplete="email"
                                value={
                                    authEmail
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAuthEmail(
                                        event.target.value
                                    )
                                }
                                disabled={
                                    isAuthBusy ||
                                    entryStage ===
                                    "entering"
                                }
                            />
                        </label>

                        <label>
                            <span>
                                PASSWORD
                            </span>

                            <input
                                type="password"
                                autoComplete={
                                    authMode ===
                                        "signup"
                                        ? "new-password"
                                        : "current-password"
                                }
                                value={
                                    authPassword
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAuthPassword(
                                        event.target.value
                                    )
                                }
                                disabled={
                                    isAuthBusy ||
                                    entryStage ===
                                    "entering"
                                }
                            />
                        </label>

                        {authMessage && (
                            <div
                                className="atlas-entry-message"
                                role="status"
                            >
                                {authMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="atlas-entry-primary"
                            disabled={
                                isAuthBusy ||
                                entryStage ===
                                "entering"
                            }
                        >
                            {entryStage ===
                                "entering"
                                ? "ENTERING..."
                                : isAuthBusy
                                    ? "CONNECTING..."
                                    : authMode ===
                                        "signup"
                                        ? "CREATE ATLAS"
                                        : "ENTER ATLAS"}
                        </button>

                        <button
                            type="button"
                            className="atlas-entry-switch"
                            disabled={
                                isAuthBusy ||
                                entryStage ===
                                "entering"
                            }
                            onClick={() => {
                                setAuthMode(
                                    (
                                        current
                                    ) =>
                                        current ===
                                            "signup"
                                            ? "login"
                                            : "signup"
                                );

                                setAuthMessage(
                                    null
                                );
                            }}
                        >
                            {authMode ===
                                "signup"
                                ? "ALREADY HAVE AN ATLAS? LOG IN"
                                : "NEW HERE? CREATE AN ATLAS"}
                        </button>
                    </form>
                )}
            </section>

            {/* APPLICATION BRAND — separate object */}

            <header className="atlas-brand atlas-app-brand">
                LIFE ATLAS
            </header>

            {/* DAY / NIGHT */}

            <div
                className={`atlas-day-night-toggle ${worldState === "all"
                        ? "is-hidden-in-all"
                        : ""
                    }`}
                role="group"
                aria-label="Atlas time of day"
                aria-hidden={
                    worldState === "all"
                }
            >
                <button
                    type="button"
                    className={
                        sceneMode === "day"
                            ? "is-active"
                            : ""
                    }
                    onClick={() =>
                        setSceneMode("day")
                    }
                    aria-pressed={
                        sceneMode === "day"
                    }
                >
                    DAY
                </button>

                <button
                    type="button"
                    className={
                        sceneMode === "night"
                            ? "is-active"
                            : ""
                    }
                    onClick={() =>
                        setSceneMode("night")
                    }
                    aria-pressed={
                        sceneMode === "night"
                    }
                >
                    NIGHT
                </button>
            </div>

            {/* CONTROLS */}

            <AtlasControls
                worldState={
                    worldState
                }

                setWorldState={(
                    state
                ) => {
                    setWorldState(
                        state
                    );

                    /*
                      TOP-LEVEL ALL = GRAND RESET

                      ALL means all time + all Collections.
                      Past / Present / Future continue to
                      combine with the currently selected
                      Collection as before.
                    */
                    if (
                        state ===
                        "all"
                    ) {
                        setSelectedCollectionIds(
                            []
                        );
                    }

                    if (
                        state !==
                        "future"
                    ) {
                        setFutureHorizon(
                            null
                        );
                    }
                }}

                futureHorizon={
                    futureHorizon
                }

                setFutureHorizon={
                    setFutureHorizon
                }

                isAddingPin={
                    isAddingPin
                }

                setIsAddingPin={(
                    value
                ) => {
                    setIsAddingPin(
                        value
                    );

                    /*
                      Starting placement closes
                      an existing selected pin.
                    */

                    if (value) {
                        setRepositionPinPosition(
                            null
                        );

                        setSelectedPin(
                            null
                        );
                    }

                    /*
                      Turning placement off removes
                      an unfinished draft.
                    */

                    if (!value) {
                        setDraftPin(
                            null
                        );
                    }
                }}

                collections={
                    collections
                }

                selectedCollectionIds={
                    selectedCollectionIds
                }

                onToggleCollection={
                    handleToggleCollection
                }

                onClearCollections={
                    handleClearCollections
                }

                onCreateCollection={
                    handleCreateCollection
                }

                pins={
                    pins
                }

                onNavigateToPin={
                    handleNavigateToPin
                }

                onRenameCollection={
                    handleRenameCollection
                }

                onDeleteCollection={
                    handleDeleteCollection
                }

                selectedPlace={
                    selectedPlace
                }

                onSelectPlace={
                    handleSelectPlace
                }

                onAddSelectedPlace={
                    handleAddSelectedPlace
                }
            />

            {/* MOBILE PIN WORKSPACE SHIELD

                On phone, when a Pin workspace is open,
                the world underneath stops receiving
                drag / zoom / tap input.

                The visible world strip also becomes a
                deliberate tap-outside close target.
            */}

            {isWorkspaceOpen &&
                hasPinWorkspace && (
                    <>
                        <button
                            type="button"
                            className="atlas-mobile-workspace-backdrop"
                            onClick={
                                handleMobileCloseWorkspace
                            }
                            aria-label="Close pin workspace"
                        />

                        <button
                            type="button"
                            className="atlas-mobile-workspace-close"
                            onClick={
                                handleMobileCloseWorkspace
                            }
                            aria-label="Close pin workspace"
                        >
                            ×
                        </button>
                    </>
                )}

            {/* WORKSPACE RESIZE RAIL */}

            <div
                className={`atlas-panel-resizer ${isPanelResizing
                    ? "is-resizing"
                    : ""
                    } ${isWorkspaceOpen
                        ? "is-open"
                        : "is-collapsed"
                    } ${!hasPinWorkspace
                        ? "is-guide"
                        : ""
                    }`}
                onPointerDown={(
                    event
                ) => {
                    event.preventDefault();

                    resizeDidMoveRef.current =
                        false;

                    if (
                        workspaceAnimationRef.current !==
                        null
                    ) {
                        cancelAnimationFrame(
                            workspaceAnimationRef.current
                        );

                        workspaceAnimationRef.current =
                            null;
                    }

                    setIsPanelResizing(
                        true
                    );
                }}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize Atlas workspace"
            >
                <button
                    type="button"
                    className="atlas-panel-resizer-handle"
                    onPointerDown={(
                        event
                    ) => {
                        event.stopPropagation();

                        /*
                          Touch / phone:
                          this is a button, not a resize grip.
                          Let the click toggle the workspace
                          without putting Atlas into resize mode.
                        */
                        const isMobileTouch =
                            window.matchMedia(
                                "(max-width: 768px), (pointer: coarse)"
                            ).matches;

                        if (
                            isMobileTouch
                        ) {
                            resizeDidMoveRef.current =
                                false;

                            return;
                        }

                        event.preventDefault();

                        resizeDidMoveRef.current =
                            false;

                        if (
                            workspaceAnimationRef.current !==
                            null
                        ) {
                            cancelAnimationFrame(
                                workspaceAnimationRef.current
                            );

                            workspaceAnimationRef.current =
                                null;
                        }

                        setIsPanelResizing(
                            true
                        );
                    }}
                    onClick={
                        handleToggleWorkspace
                    }
                    aria-label={
                        isWorkspaceOpen
                            ? "Collapse Atlas workspace"
                            : "Open Atlas workspace"
                    }
                >
                    <span
                        className="atlas-panel-resizer-chevron-group"
                        aria-hidden="true"
                    >
                        <span>
                            {isWorkspaceOpen
                                ? "›"
                                : "‹"}
                        </span>

                        <span>
                            {isWorkspaceOpen
                                ? "›"
                                : "‹"}
                        </span>
                    </span>
                </button>
            </div>

            {/* GUIDE WORKSPACE */}

            {isWorkspaceOpen &&
                !hasPinWorkspace && (
                    <aside className="atlas-guide-panel">
                        <div className="atlas-guide-scroll">
                            <div className="atlas-guide-eyebrow">
                                YOUR ATLAS
                            </div>

                            <h2 className="atlas-guide-title">
                                A spatial view of your life.
                            </h2>

                            <p className="atlas-guide-copy">
                                Places you have been,
                                where you are now, and
                                where you are moving
                                toward can live together
                                here.
                            </p>

                            <div className="atlas-guide-video">
                                <div className="atlas-guide-video-mark">
                                    PLAY
                                </div>

                                <div className="atlas-guide-video-copy">
                                    ATLAS OVERVIEW
                                    <span>
                                        Tutorial video
                                        placeholder
                                    </span>
                                </div>
                            </div>

                            <div className="atlas-guide-section">
                                <span>
                                    START SOMEWHERE
                                </span>

                                <p>
                                    Open the left drawer
                                    and add a pin, or
                                    select an existing
                                    point on the globe.
                                </p>
                            </div>

                            <div className="atlas-guide-section">
                                <span>
                                    MOVE THROUGH TIME
                                </span>

                                <p>
                                    Past, Present and
                                    Future change the
                                    world you are looking
                                    through.
                                </p>
                            </div>

                            <div className="atlas-guide-note">
                                This guide is temporary
                                filler content. We will
                                replace it with the final
                                onboarding experience.
                            </div>
                        </div>
                    </aside>
                )}

            {/* PIN WORKSPACE */}

            {isWorkspaceOpen &&
                hasPinWorkspace && (
                    <AtlasPanel
                        key={
                            selectedPin
                                ? `selected-${selectedPin.id}`
                                : draftPin
                                    ? `draft-${draftPin.latitude}-${draftPin.longitude}`
                                    : "no-pin"
                        }

                        draftPin={
                            draftPin
                        }

                        selectedPin={
                            selectedPin
                        }

                        defaultTimeState={
                            getDefaultTimeState()
                        }

                        collections={
                            collections
                        }

                        onCancel={
                            handleClosePanel
                        }

                        onSave={
                            handleSavePin
                        }

                        onUpdate={
                            handleUpdatePin
                        }

                        onDelete={
                            handleDeletePin
                        }

                        isRepositioningPin={
                            repositionPinPosition !==
                            null
                        }

                        repositionPinPosition={
                            repositionPinPosition
                        }

                        onStartRepositionPin={
                            handleStartRepositionPin
                        }

                        onCancelRepositionPin={
                            handleCancelRepositionPin
                        }

                        onSaveRepositionPin={
                            handleSaveRepositionPin
                        }

                        onPinCoverChange={
                            handlePinCoverChange
                        }

                        onMomentsChange={
                            handleMomentsChange
                        }
                    />
                )}
        </main>
    );
}