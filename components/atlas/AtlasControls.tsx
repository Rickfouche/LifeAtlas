"use client";

import {
    useRef,
    useState,
    type KeyboardEvent,
} from "react";

import type {
    AtlasCollection,
    AtlasPin,
    AtlasPlaceSearchResult,
    AtlasWorldState,
} from "@/types/atlas";

/* =========================================
   PROPS
========================================= */

type AtlasControlsProps = {
    worldState: AtlasWorldState;

    setWorldState: (
        state: AtlasWorldState
    ) => void;

    futureHorizon:
    | "week"
    | "month"
    | "year"
    | null;

    setFutureHorizon: (
        horizon:
            | "week"
            | "month"
            | "year"
            | null
    ) => void;

    isAddingPin: boolean;

    setIsAddingPin: (
        value: boolean
    ) => void;

    collections: AtlasCollection[];

    selectedCollectionIds: string[];

    onToggleCollection: (
        collectionId: string
    ) => void;

    onClearCollections: () => void;

    onCreateCollection: (
        name: string
    ) => Promise<void>;

    pins: AtlasPin[];

    onNavigateToPin: (
        pin: AtlasPin
    ) => void;

    onRenameCollection: (
        collectionId: string,
        name: string
    ) => Promise<void>;

    onDeleteCollection: (
        collectionId: string
    ) => Promise<void>;

    selectedPlace:
    AtlasPlaceSearchResult | null;

    onSelectPlace: (
        place: AtlasPlaceSearchResult
    ) => void;

    onAddSelectedPlace:
    () => void;
};

/* =========================================
   COMPONENT
========================================= */

export default function AtlasControls({
    worldState,
    setWorldState,
    futureHorizon,
    setFutureHorizon,
    isAddingPin,
    setIsAddingPin,
    collections,
    selectedCollectionIds,
    onToggleCollection,
    onClearCollections,
    onCreateCollection,
    pins,
    onNavigateToPin,
    onRenameCollection,
    onDeleteCollection,
    selectedPlace,
    onSelectPlace,
    onAddSelectedPlace,
}: AtlasControlsProps) {
    /* =========================================
       LOCAL UI STATE
    ========================================= */

    const [
        drawerOpen,
        setDrawerOpen,
    ] = useState(false);

    const [
        isFutureMenuOpen,
        setIsFutureMenuOpen,
    ] = useState(false);

    const [
        placeQuery,
        setPlaceQuery,
    ] = useState("");

    const [
        placeResults,
        setPlaceResults,
    ] =
        useState<
            AtlasPlaceSearchResult[]
        >([]);

    const [
        isPlaceSearchOpen,
        setIsPlaceSearchOpen,
    ] = useState(false);

    const [
        isSearchingPlaces,
        setIsSearchingPlaces,
    ] = useState(false);

    const [
        placeSearchError,
        setPlaceSearchError,
    ] = useState("");

    const placeSearchRequestRef =
        useRef(0);

    const [
        isCreatingCollection,
        setIsCreatingCollection,
    ] = useState(false);

    const [
        newCollectionName,
        setNewCollectionName,
    ] = useState("");

    const [
        isSavingCollection,
        setIsSavingCollection,
    ] = useState(false);

    const [
        expandedCollectionIds,
        setExpandedCollectionIds,
    ] = useState<string[]>([]);

    const [
        managingCollectionId,
        setManagingCollectionId,
    ] = useState<string | null>(
        null
    );

    const [
        renamingCollectionId,
        setRenamingCollectionId,
    ] = useState<string | null>(
        null
    );

    const [
        collectionRenameValue,
        setCollectionRenameValue,
    ] = useState("");

    const [
        isRenamingCollection,
        setIsRenamingCollection,
    ] = useState(false);

    const [
        deletingCollectionId,
        setDeletingCollectionId,
    ] = useState<string | null>(
        null
    );

    const [
        collectionManageError,
        setCollectionManageError,
    ] = useState("");

    /* =========================================
           WORLD STATE
        ========================================= */

    const selectWorldState = (
        state: AtlasWorldState
    ) => {
        setWorldState(state);

        if (
            state !==
            "future"
        ) {
            setFutureHorizon(
                null
            );

            setIsFutureMenuOpen(
                false
            );
        }

        /*
          Leaving Add Pin mode when
          changing temporal state keeps
          pin placement intentional.
        */

        setIsAddingPin(false);
    };


    const handleFutureParentClick =
        () => {
            setIsAddingPin(false);

            /*
              Entering Future from another mode:
              broad Future, submenu closed.
            */
            if (
                worldState !==
                "future"
            ) {
                setWorldState(
                    "future"
                );

                setFutureHorizon(
                    null
                );

                setIsFutureMenuOpen(
                    false
                );

                return;
            }

            /*
              If a horizon is active, FUTURE acts
              as the parent reset:
              WEEK / MONTH / YEAR -> ALL FUTURE.
            */
            if (futureHorizon) {
                setFutureHorizon(
                    null
                );

                setIsFutureMenuOpen(
                    false
                );

                return;
            }

            /*
              Already on broad Future:
              FUTURE exposes / hides its child lenses.
            */
            setIsFutureMenuOpen(
                (current) =>
                    !current
            );
        };


    const handleFutureArrowClick =
        () => {
            setIsAddingPin(false);

            if (
                worldState !==
                "future"
            ) {
                setWorldState(
                    "future"
                );

                setFutureHorizon(
                    null
                );
            }

            setIsFutureMenuOpen(
                (current) =>
                    !current
            );
        };

    /* =========================================
       ADD PIN
    ========================================= */

    const handleToggleAddPin = () => {
        if (
            selectedPlace &&
            !isAddingPin
        ) {
            onAddSelectedPlace();
            return;
        }

        setIsAddingPin(
            !isAddingPin
        );
    };

    /* =========================================
       OPEN NEW COLLECTION
    ========================================= */

    const handleOpenNewCollection =
        () => {
            setNewCollectionName("");
            setIsCreatingCollection(true);
        };

    /* =========================================
       CANCEL NEW COLLECTION
    ========================================= */

    const handleCancelNewCollection =
        () => {
            setNewCollectionName("");
            setIsCreatingCollection(false);
        };

    /* =========================================
       CREATE COLLECTION
    ========================================= */

    const handleCreateCollection =
        async () => {
            const trimmedName =
                newCollectionName.trim();

            if (
                !trimmedName ||
                isSavingCollection
            ) {
                return;
            }

            setIsSavingCollection(true);

            try {
                await onCreateCollection(
                    trimmedName
                );

                setNewCollectionName("");
                setIsCreatingCollection(false);
            } catch (error) {
                console.error(
                    "Could not create collection:",
                    error
                );
            } finally {
                setIsSavingCollection(false);
            }
        };

    /* =========================================
       COLLECTION INPUT KEYBOARD
    ========================================= */

    const handleCollectionKeyDown = (
        event: KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === "Enter") {
            event.preventDefault();

            void handleCreateCollection();
        }

        if (event.key === "Escape") {
            event.preventDefault();

            handleCancelNewCollection();
        }
    };

    /* =========================================
       GOOGLE PLACE SEARCH
    ========================================= */

    const searchPlaces =
        async (
            explicitQuery?: string
        ) => {
            const query =
                (
                    explicitQuery ??
                    placeQuery
                ).trim();

            if (
                query.length < 2
            ) {
                setPlaceResults([]);

                setPlaceSearchError(
                    query.length === 0
                        ? ""
                        : "TYPE AT LEAST 2 CHARACTERS"
                );

                setIsPlaceSearchOpen(
                    true
                );

                return;
            }

            const requestId =
                placeSearchRequestRef.current +
                1;

            placeSearchRequestRef.current =
                requestId;

            setIsSearchingPlaces(
                true
            );

            setPlaceSearchError("");

            setIsPlaceSearchOpen(
                true
            );

            try {
                const response =
                    await fetch(
                        "/api/places/search",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            body:
                                JSON.stringify({
                                    query,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    requestId !==
                    placeSearchRequestRef.current
                ) {
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                        "Could not search places."
                    );
                }

                setPlaceResults(
                    (
                        result.places ??
                        []
                    ) as AtlasPlaceSearchResult[]
                );
            } catch (error) {
                console.error(
                    "Place search failed:",
                    error
                );

                setPlaceResults([]);

                setPlaceSearchError(
                    error instanceof Error
                        ? error.message
                        : "Could not search places."
                );
            } finally {
                if (
                    requestId ===
                    placeSearchRequestRef.current
                ) {
                    setIsSearchingPlaces(
                        false
                    );
                }
            }
        };

    const handlePlaceSearchKeyDown =
        (
            event:
                KeyboardEvent<HTMLInputElement>
        ) => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();
                void searchPlaces();
            }

            if (
                event.key ===
                "Escape"
            ) {
                setIsPlaceSearchOpen(
                    false
                );
            }
        };

    const handleChoosePlace =
        (
            place:
                AtlasPlaceSearchResult
        ) => {
            onSelectPlace(place);

            setPlaceQuery(
                place.name
            );

            setIsPlaceSearchOpen(
                false
            );

            setPlaceSearchError("");
        };

    /* =========================================
       COLLECTION NAVIGATION + MANAGEMENT
    ========================================= */

    const toggleCollectionExpanded =
        (
            collectionId: string
        ) => {
            setExpandedCollectionIds(
                (current) =>
                    current.includes(
                        collectionId
                    )
                        ? current.filter(
                            (id) =>
                                id !==
                                collectionId
                        )
                        : [
                            ...current,
                            collectionId,
                        ]
            );

            setManagingCollectionId(
                null
            );

            setRenamingCollectionId(
                null
            );

            setCollectionManageError(
                ""
            );
        };

    const openCollectionManagement =
        (
            collectionId: string
        ) => {
            setManagingCollectionId(
                (current) =>
                    current ===
                        collectionId
                        ? null
                        : collectionId
            );

            setRenamingCollectionId(
                null
            );

            setCollectionManageError(
                ""
            );
        };

    const startRenameCollection =
        (
            collection:
                AtlasCollection
        ) => {
            setRenamingCollectionId(
                collection.id
            );

            setCollectionRenameValue(
                collection.name
            );

            setCollectionManageError(
                ""
            );
        };

    const cancelRenameCollection =
        () => {
            setRenamingCollectionId(
                null
            );

            setCollectionRenameValue(
                ""
            );

            setCollectionManageError(
                ""
            );
        };

    const saveRenameCollection =
        async (
            collectionId: string
        ) => {
            const name =
                collectionRenameValue.trim();

            if (
                !name ||
                isRenamingCollection
            ) {
                return;
            }

            setIsRenamingCollection(
                true
            );

            setCollectionManageError(
                ""
            );

            try {
                await onRenameCollection(
                    collectionId,
                    name
                );

                setRenamingCollectionId(
                    null
                );

                setManagingCollectionId(
                    null
                );

                setCollectionRenameValue(
                    ""
                );
            } catch (error) {
                console.error(
                    "Could not rename Collection:",
                    error
                );

                setCollectionManageError(
                    error instanceof Error
                        ? error.message
                        : "Could not rename Collection."
                );
            } finally {
                setIsRenamingCollection(
                    false
                );
            }
        };

    const deleteCollection =
        async (
            collection:
                AtlasCollection
        ) => {
            if (
                deletingCollectionId
            ) {
                return;
            }

            const pinCount =
                pins.filter(
                    (pin) =>
                        pin.collectionIds.includes(
                            collection.id
                        )
                ).length;

            const confirmed =
                window.confirm(
                    `Delete "${collection.name}"?\n\nThis removes the Collection and its associations from ${pinCount} pin${pinCount === 1 ? "" : "s"}.\n\nThe Pins, Moments, People and Content will remain in Atlas.`
                );

            if (!confirmed) {
                return;
            }

            setDeletingCollectionId(
                collection.id
            );

            setCollectionManageError(
                ""
            );

            try {
                await onDeleteCollection(
                    collection.id
                );

                setExpandedCollectionIds(
                    (current) =>
                        current.filter(
                            (id) =>
                                id !==
                                collection.id
                        )
                );

                setManagingCollectionId(
                    null
                );

                setRenamingCollectionId(
                    null
                );
            } catch (error) {
                console.error(
                    "Could not delete Collection:",
                    error
                );

                setCollectionManageError(
                    error instanceof Error
                        ? error.message
                        : "Could not delete Collection."
                );
            } finally {
                setDeletingCollectionId(
                    null
                );
            }
        };

    /* =========================================
       COLLECTION STATE
    ========================================= */

    const allCollectionsActive =
        selectedCollectionIds.length === 0;

    /* =========================================
       RENDER
    ========================================= */

    return (
        <>
            {/* =====================================
          PRIMARY MODE BAR
      ===================================== */}

            <nav
                className={`atlas-time-controls atlas-time-controls--horizontal ${isFutureMenuOpen &&
                    worldState === "future" &&
                    !isAddingPin
                    ? "is-future-menu-open"
                    : ""
                    }`}
                aria-label="Atlas mode"
            >
                {(
                    [
                        ["all", "ALL"],
                        ["past", "PAST"],
                        ["present", "PRESENT"],
                    ] as const
                ).map(([state, label]) => (
                    <button
                        key={state}
                        type="button"
                        className={
                            worldState === state &&
                                !isAddingPin
                                ? "is-active"
                                : ""
                        }
                        onClick={() =>
                            selectWorldState(state)
                        }
                    >
                        {label}
                    </button>
                ))}

                <div
                    className={`atlas-future-parent ${worldState === "future" &&
                        !isAddingPin
                        ? "is-active"
                        : ""
                        } ${isFutureMenuOpen &&
                            worldState === "future" &&
                            !isAddingPin
                            ? "is-open"
                            : ""
                        }`}
                >
                    <div className="atlas-future-parent-row">
                        <button
                            type="button"
                            className={
                                worldState === "future" &&
                                    !isAddingPin
                                    ? "is-active"
                                    : ""
                            }
                            onClick={
                                handleFutureParentClick
                            }
                            aria-pressed={
                                worldState === "future" &&
                                !isAddingPin
                            }
                        >
                            FUTURE
                        </button>

                        <button
                            type="button"
                            className={`atlas-future-arrow ${isFutureMenuOpen
                                ? "is-open"
                                : ""
                                } ${worldState === "future" &&
                                    !isAddingPin
                                    ? "is-active"
                                    : ""
                                }`}
                            onClick={
                                handleFutureArrowClick
                            }
                            aria-expanded={
                                isFutureMenuOpen
                            }
                            aria-label={
                                isFutureMenuOpen
                                    ? "Hide Future horizons"
                                    : "Show Future horizons"
                            }
                        >
                            <span aria-hidden="true">
                                ⌄
                            </span>
                        </button>
                    </div>

                    <div
                        className={`atlas-present-lens ${worldState === "future" &&
                            isFutureMenuOpen &&
                            !isAddingPin
                            ? "is-visible"
                            : ""
                            }`}
                        aria-hidden={
                            worldState !== "future" ||
                            !isFutureMenuOpen ||
                            isAddingPin
                        }
                    >
                        {(
                            [
                                "week",
                                "month",
                                "year",
                            ] as const
                        ).map((horizon) => (
                            <button
                                key={horizon}
                                type="button"
                                className={
                                    futureHorizon ===
                                        horizon
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() => {
                                    setFutureHorizon(
                                        horizon
                                    );

                                    setIsFutureMenuOpen(
                                        true
                                    );
                                }}
                                tabIndex={
                                    worldState === "future" &&
                                        isFutureMenuOpen &&
                                        !isAddingPin
                                        ? 0
                                        : -1
                                }
                                aria-pressed={
                                    futureHorizon ===
                                    horizon
                                }
                            >
                                {horizon.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    className={`atlas-mode-add ${isAddingPin
                        ? "is-active"
                        : ""
                        } ${selectedPlace &&
                            !isAddingPin
                            ? "is-place-ready"
                            : ""
                        }`}
                    onClick={
                        handleToggleAddPin
                    }
                >
                    ADD
                </button>
            </nav>

            {/* =====================================
          COLLECTION DRAWER
      ===================================== */}

            <aside
                className={`atlas-drawer ${drawerOpen
                    ? "is-open"
                    : ""
                    }`}
            >
                {/* DRAWER TAB */}

                <button
                    type="button"
                    className="atlas-drawer-tab"
                    onClick={() =>
                        setDrawerOpen(
                            (current) =>
                                !current
                        )
                    }
                    aria-expanded={
                        drawerOpen
                    }
                    aria-label={
                        drawerOpen
                            ? "Close Atlas controls"
                            : "Open Atlas controls"
                    }
                >
                    <span className="atlas-tab-sigil">
                        ◇
                    </span>
                </button>

                {/* DRAWER CONTENT */}

                <div className="atlas-drawer-content">
                    <div className="atlas-drawer-heading">
                        COLLECTIONS
                    </div>

                    {/* =================================
              PLACE SEARCH
          ================================= */}

                    <div className="atlas-place-search">
                        <div className="atlas-place-search-label">
                            PLACE SEARCH
                        </div>

                        <div className="atlas-place-search-input-wrap">
                            <input
                                type="search"
                                value={
                                    placeQuery
                                }
                                onChange={(
                                    event
                                ) => {
                                    setPlaceQuery(
                                        event.target.value
                                    );

                                    setIsPlaceSearchOpen(
                                        true
                                    );
                                }}
                                onFocus={() =>
                                    setIsPlaceSearchOpen(
                                        true
                                    )
                                }
                                onKeyDown={
                                    handlePlaceSearchKeyDown
                                }
                                placeholder="Search a place..."
                                aria-label="Search Google Places"
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    void searchPlaces()
                                }
                                disabled={
                                    isSearchingPlaces ||
                                    placeQuery.trim()
                                        .length < 2
                                }
                                aria-label="Search place"
                            >
                                {isSearchingPlaces
                                    ? "..."
                                    : "↗"}
                            </button>
                        </div>

                        {selectedPlace && (
                            <button
                                type="button"
                                className="atlas-place-selected"
                                onClick={() =>
                                    setIsPlaceSearchOpen(
                                        true
                                    )
                                }
                                title="Selected Google place"
                            >
                                <span>
                                    {
                                        selectedPlace.name
                                    }
                                </span>

                                <small>
                                    {
                                        selectedPlace.formattedAddress
                                    }
                                </small>
                            </button>
                        )}

                        {isPlaceSearchOpen && (
                            <div className="atlas-place-results">
                                {isSearchingPlaces ? (
                                    <div className="atlas-place-results-state">
                                        SEARCHING...
                                    </div>
                                ) : placeSearchError ? (
                                    <div className="atlas-place-results-state is-error">
                                        {
                                            placeSearchError
                                        }
                                    </div>
                                ) : placeResults.length > 0 ? (
                                    placeResults.map(
                                        (place) => (
                                            <button
                                                key={
                                                    place.id
                                                }
                                                type="button"
                                                className={
                                                    selectedPlace?.id ===
                                                        place.id
                                                        ? "is-selected"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    handleChoosePlace(
                                                        place
                                                    )
                                                }
                                            >
                                                <span>
                                                    {
                                                        place.name
                                                    }
                                                </span>

                                                <small>
                                                    {
                                                        place.formattedAddress
                                                    }
                                                </small>
                                            </button>
                                        )
                                    )
                                ) : placeQuery.trim()
                                    .length >= 2 ? (
                                    <div className="atlas-place-results-state">
                                        PRESS ENTER TO SEARCH
                                    </div>
                                ) : (
                                    <div className="atlas-place-results-state">
                                        TYPE TO SEARCH
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* =================================
              COLLECTION LIST
          ================================= */}

                    <div className="atlas-collection-list">
                        {/* ALL COLLECTIONS */}

                        <button
                            type="button"
                            className={
                                allCollectionsActive
                                    ? "is-active"
                                    : ""
                            }
                            onClick={
                                onClearCollections
                            }
                            aria-pressed={
                                allCollectionsActive
                            }
                        >
                            ALL
                        </button>

                        {/* SAVED COLLECTIONS */}

                        {collections.map(
                            (collection) => {
                                const isSelected =
                                    selectedCollectionIds.includes(
                                        collection.id
                                    );

                                const isExpanded =
                                    expandedCollectionIds.includes(
                                        collection.id
                                    );

                                const isManaging =
                                    managingCollectionId ===
                                    collection.id;

                                const isRenamingThis =
                                    renamingCollectionId ===
                                    collection.id;

                                const collectionPins =
                                    pins.filter(
                                        (pin) =>
                                            pin.collectionIds.includes(
                                                collection.id
                                            )
                                    );

                                return (
                                    <div
                                        key={
                                            collection.id
                                        }
                                        style={{
                                            width:
                                                "100%",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display:
                                                    "grid",
                                                gridTemplateColumns:
                                                    "26px minmax(0, 1fr) 28px",
                                                gap:
                                                    "4px",
                                                alignItems:
                                                    "center",
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleCollectionExpanded(
                                                        collection.id
                                                    )
                                                }
                                                aria-expanded={
                                                    isExpanded
                                                }
                                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${collection.name}`}
                                                style={{
                                                    minWidth:
                                                        0,
                                                    padding:
                                                        "0",
                                                }}
                                            >
                                                {isExpanded
                                                    ? "⌄"
                                                    : "›"}
                                            </button>

                                            <button
                                                type="button"
                                                className={
                                                    isSelected
                                                        ? "is-active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    onToggleCollection(
                                                        collection.id
                                                    )
                                                }
                                                aria-pressed={
                                                    isSelected
                                                }
                                                style={{
                                                    minWidth:
                                                        0,
                                                    textAlign:
                                                        "left",
                                                    overflow:
                                                        "hidden",
                                                    textOverflow:
                                                        "ellipsis",
                                                    whiteSpace:
                                                        "nowrap",
                                                }}
                                            >
                                                {collection.name.toUpperCase()}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openCollectionManagement(
                                                        collection.id
                                                    )
                                                }
                                                aria-expanded={
                                                    isManaging
                                                }
                                                aria-label={`Manage ${collection.name}`}
                                                style={{
                                                    minWidth:
                                                        0,
                                                    padding:
                                                        "0",
                                                    letterSpacing:
                                                        "1px",
                                                }}
                                            >
                                                ···
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div
                                                style={{
                                                    padding:
                                                        "4px 0 8px 30px",
                                                }}
                                            >
                                                {collectionPins.length ===
                                                    0 ? (
                                                    <div
                                                        style={{
                                                            opacity:
                                                                0.45,
                                                            padding:
                                                                "6px 4px",
                                                            fontSize:
                                                                "10px",
                                                            letterSpacing:
                                                                "0.08em",
                                                        }}
                                                    >
                                                        NO PINS
                                                    </div>
                                                ) : (
                                                    collectionPins.map(
                                                        (pin) => (
                                                            <button
                                                                key={
                                                                    pin.id
                                                                }
                                                                type="button"
                                                                onClick={() =>
                                                                    onNavigateToPin(
                                                                        pin
                                                                    )
                                                                }
                                                                title={`Go to ${pin.title}`}
                                                                style={{
                                                                    display:
                                                                        "block",
                                                                    width:
                                                                        "100%",
                                                                    textAlign:
                                                                        "left",
                                                                    padding:
                                                                        "7px 8px",
                                                                    opacity:
                                                                        0.78,
                                                                    fontSize:
                                                                        "10px",
                                                                    letterSpacing:
                                                                        "0.08em",
                                                                    overflow:
                                                                        "hidden",
                                                                    textOverflow:
                                                                        "ellipsis",
                                                                    whiteSpace:
                                                                        "nowrap",
                                                                }}
                                                            >
                                                                ↳ {pin.title.toUpperCase()}
                                                            </button>
                                                        )
                                                    )
                                                )}
                                            </div>
                                        )}

                                        {isManaging && (
                                            <div
                                                style={{
                                                    margin:
                                                        "5px 0 9px 30px",
                                                    padding:
                                                        "8px",
                                                    border:
                                                        "1px solid rgba(141, 228, 255, 0.14)",
                                                    background:
                                                        "rgba(3, 10, 17, 0.58)",
                                                }}
                                            >
                                                {isRenamingThis ? (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={
                                                                collectionRenameValue
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                setCollectionRenameValue(
                                                                    event.target.value
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                event
                                                            ) => {
                                                                if (
                                                                    event.key ===
                                                                    "Enter"
                                                                ) {
                                                                    event.preventDefault();

                                                                    void saveRenameCollection(
                                                                        collection.id
                                                                    );
                                                                }

                                                                if (
                                                                    event.key ===
                                                                    "Escape"
                                                                ) {
                                                                    event.preventDefault();

                                                                    cancelRenameCollection();
                                                                }
                                                            }}
                                                            aria-label={`Rename ${collection.name}`}
                                                            autoFocus
                                                        />

                                                        <div className="atlas-new-collection-actions">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void saveRenameCollection(
                                                                        collection.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    isRenamingCollection ||
                                                                    !collectionRenameValue.trim()
                                                                }
                                                            >
                                                                {isRenamingCollection
                                                                    ? "SAVING..."
                                                                    : "SAVE"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    cancelRenameCollection
                                                                }
                                                                disabled={
                                                                    isRenamingCollection
                                                                }
                                                            >
                                                                CANCEL
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display:
                                                                "flex",
                                                            gap:
                                                                "6px",
                                                            flexWrap:
                                                                "wrap",
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                startRenameCollection(
                                                                    collection
                                                                )
                                                            }
                                                        >
                                                            RENAME
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void deleteCollection(
                                                                    collection
                                                                )
                                                            }
                                                            disabled={
                                                                deletingCollectionId ===
                                                                collection.id
                                                            }
                                                        >
                                                            {deletingCollectionId ===
                                                                collection.id
                                                                ? "DELETING..."
                                                                : "DELETE"}
                                                        </button>
                                                    </div>
                                                )}

                                                {collectionManageError && (
                                                    <div
                                                        style={{
                                                            marginTop:
                                                                "7px",
                                                            fontSize:
                                                                "10px",
                                                            opacity:
                                                                0.72,
                                                        }}
                                                    >
                                                        {collectionManageError}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        )}

                        {/* =================================
                NEW COLLECTION BUTTON
            ================================= */}

                        {!isCreatingCollection && (
                            <button
                                type="button"
                                className="atlas-new-collection"
                                onClick={
                                    handleOpenNewCollection
                                }
                            >
                                + NEW COLLECTION
                            </button>
                        )}

                        {/* =================================
                NEW COLLECTION FORM
            ================================= */}

                        {isCreatingCollection && (
                            <div className="atlas-new-collection-form">
                                <input
                                    type="text"
                                    value={
                                        newCollectionName
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setNewCollectionName(
                                            event.target.value
                                        )
                                    }
                                    onKeyDown={
                                        handleCollectionKeyDown
                                    }
                                    placeholder="COLLECTION NAME"
                                    aria-label="New collection name"
                                    autoFocus
                                />

                                <div className="atlas-new-collection-actions">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleCreateCollection()
                                        }
                                        disabled={
                                            isSavingCollection ||
                                            !newCollectionName.trim()
                                        }
                                    >
                                        {isSavingCollection
                                            ? "SAVING..."
                                            : "CREATE"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            handleCancelNewCollection
                                        }
                                        disabled={
                                            isSavingCollection
                                        }
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}