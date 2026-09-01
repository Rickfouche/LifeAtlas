"use client";

import {
    useEffect,
    useRef,
} from "react";

import {
    Map,
    Marker,
    setWorkerUrl,
    type MapMouseEvent,
    type GeoJSONSource,
    type ExpressionSpecification,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import type {
    AtlasDraftPin,
    AtlasPin,
    AtlasPlaceSearchResult,
    AtlasWorldState,
} from "@/types/atlas";

import {
    atlasModeStyles,
} from "@/config/atlasConfig";

/* =========================================
   GLOBE ATMOSPHERE

   Personal Beta visual identity:
   dark space + cyan geography + a stronger
   gold electrical edge.

   These five values are the only ones you
   need to tune for atmosphere intensity.
========================================= */

const GLOBE_ATMOSPHERE = {
    color:
        "#ffd84a",

    horizonBlend:
        0.08,

    horizonFogBlend:
        0.10,

    fogGroundBlend:
        0.06,

    atmosphereBlend:
        0.32,
} as const;

/* =========================================
   UNIFIED DAY / NIGHT GEOGRAPHY

   Temporal modes no longer recolor the globe.

   NIGHT:
   uses the current Present-night geography
   as the shared baseline for ALL / PAST /
   PRESENT / FUTURE.

   DAY:
   blue water + green land.

   Temporal identity is carried by atmosphere,
   backdrop, Pins and UI instead.
========================================= */

const DAY_GLOBE = {
    /*
      Keep the globe water translucent so the
      environmental artwork behind MapLibre
      can still breathe through it.
    */
    water:
        "rgba(24, 122, 184, 0.55)",

    /*
      Vibrant tree-green body.
      Strong enough to read as land, but still
      dark enough for the neon perimeter to lead.
    */
    land:
        "#2f7a46",

    landOpacity:
        0.88,

    /*
      Bright electric green perimeter.
    */
    coast:
        "#6dff63",

    coastOpacity:
        0.96,

    coastGlowOpacity:
        0.34,

    /*
      Internal borders stay in the same green
      family, just several shades darker and
      low-opacity so they are discovered rather
      than competing with the landmass silhouette.
    */
    country:
        "#245c3a",

    countryOpacity:
        0.24,
} as const;

const NIGHT_GLOBE = {
    water:
        "#07090d",

    coast:
        "#27c7ff",

    coastOpacity:
        0.70,

    coastGlowOpacity:
        0.22,

    country:
        "#8de4ff",

    countryOpacity:
        0.14,
} as const;

/* =========================================
   ALL — RETRO DIGITAL ATLAS

   ALL is intentionally not Day or Night.
   It ignores sceneMode and becomes a dark,
   high-neon overview with no atmospheric
   sphere edge and no scenic backdrop.
========================================= */

const ALL_GLOBE = {
    space:
        "rgba(7, 9, 13, 0)",

    land:
        "#08b9ee",

    landOpacity:
        0.90,

    edge:
        "#2adfff",

    edgeOpacity:
        0.98,

    glowOpacity:
        0.42,

    country:
        "#73e6ff",

    countryOpacity:
        0.34,
} as const;

/* =========================================
   DETAIL VIEW

   Life Atlas remains the information layer.
   OpenFreeMap only supplies physical city
   structure at close zoom:
   - land use / parks
   - roads
   - building footprints
   - NO labels / POIs / businesses

   The same threshold also disables idle
   planetary rotation.
========================================= */

const DETAIL_VIEW_ZOOM = 7;

const DETAIL_BUILDING_ZOOM = 12;

const DETAIL_MAX_ZOOM = 16;

const PIN_CLUSTER_MAX_ZOOM = 11;

const PIN_CLUSTER_RADIUS = 58;

/* =========================================
   ZOOM-DEPENDENT WORLD OVERLAY

   The coarse countries GeoJSON is perfect for the
   planetary Atlas, but it should gracefully hand off
   to the detailed OpenFreeMap geometry at city scale.

   0–6.25: full authored globe
   6.25–8.25: smooth fade
   8.25+: physical detail map owns geography
========================================= */

function worldOverlayOpacity(
    baseOpacity: number
): ExpressionSpecification {
    return [
        "interpolate",
        ["linear"],
        ["zoom"],
        6.25,
        baseOpacity,
        8.25,
        0,
    ];
}

function detailRoadOpacity(
    sceneMode: "day" | "night"
): ExpressionSpecification {
    return [
        "interpolate",
        ["linear"],
        ["zoom"],
        DETAIL_VIEW_ZOOM,
        0,
        8,
        sceneMode === "day"
            ? 0.24
            : 0.18,
        11,
        sceneMode === "day"
            ? 0.48
            : 0.34,
        16,
        sceneMode === "day"
            ? 0.68
            : 0.48,
    ];
}

/* =========================================
   PROPS
========================================= */

type AtlasGlobeProps = {
    worldState: AtlasWorldState;

    sceneMode:
    | "day"
    | "night";

    entryStage:
    | "checking"
    | "login"
    | "verify"
    | "entering"
    | "ready";

    isAddingPin: boolean;

    isRepositioningPin:
    boolean;

    repositioningPinId:
    string | null;

    repositionPin:
    AtlasDraftPin | null;

    pins: AtlasPin[];

    draftPin:
    AtlasDraftPin | null;

    workspaceRightInset: number;

    visualCenterYOffset: number;

    focusPin:
    AtlasPin | null;

    focusRequestId: number;

    previewPlace:
    AtlasPlaceSearchResult | null;

    previewPlaceRequestId: number;

    onCreateDraftPin: (
        pin: AtlasDraftPin
    ) => void;

    onRepositionPin: (
        pin: AtlasDraftPin
    ) => void;

    onSelectPin: (
        pin: AtlasPin
    ) => void;
};

/* =========================================
   COMPONENT
========================================= */

export default function AtlasGlobe({
    worldState,
    sceneMode,
    entryStage,
    isAddingPin,
    isRepositioningPin,
    repositioningPinId,
    repositionPin,
    pins,
    draftPin,
    workspaceRightInset,
    visualCenterYOffset,
    focusPin,
    focusRequestId,
    previewPlace,
    previewPlaceRequestId,
    onCreateDraftPin,
    onRepositionPin,
    onSelectPin,
}: AtlasGlobeProps) {
    const mapContainerRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const mapRef =
        useRef<Map | null>(
            null
        );

    const savedMarkersRef =
        useRef<Marker[]>([]);

    const draftMarkerRef =
        useRef<Marker | null>(
            null
        );

    const repositionMarkerRef =
        useRef<Marker | null>(
            null
        );

    const placePreviewMarkerRef =
        useRef<Marker | null>(
            null
        );

    /* =========================================
       IDLE GLOBE MOTION
    ========================================= */

    const lastInteractionRef =
        useRef(
            Date.now()
        );

    const isUserInteractingRef =
        useRef(false);

    const idleSpinFrameRef =
        useRef<number | null>(
            null
        );

    const lastSpinFrameTimeRef =
        useRef<number | null>(
            null
        );

    const idleSpinSpeedRef =
        useRef(0);

    /* =========================================
       CREATE MAP
    ========================================= */

    useEffect(() => {
        if (
            !mapContainerRef.current ||
            mapRef.current
        ) {
            return;
        }

        setWorkerUrl(
            "/maplibre-gl-worker.mjs"
        );

        const map = new Map({
            container:
                mapContainerRef.current,

            style: {
                version: 8,

                sources: {},

                /*
                  Needed only for the numeric cluster
                  count symbol. No geographic labels
                  are loaded into Life Atlas.
                */
                glyphs:
                    "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",

                /*
                  CYBERPUNK ATMOSPHERE

                  All light uses one gold hue so it reads
                  as a single electrical planetary glow.
                */
                sky: {
                    "sky-color":
                        "rgba(0, 0, 0, 0)",

                    "horizon-color":
                        GLOBE_ATMOSPHERE.color,

                    "sky-horizon-blend":
                        GLOBE_ATMOSPHERE.horizonBlend,

                    "horizon-fog-blend":
                        GLOBE_ATMOSPHERE.horizonFogBlend,

                    "fog-color":
                        GLOBE_ATMOSPHERE.color,

                    "fog-ground-blend":
                        GLOBE_ATMOSPHERE.fogGroundBlend,

                    "atmosphere-blend":
                        GLOBE_ATMOSPHERE.atmosphereBlend,
                },

                layers: [
                    {
                        id: "space",

                        type: "background",

                        paint: {
                            "background-color":
                                "#07090d",

                            "background-color-transition": {
                                duration: 450,
                                delay: 0,
                            },
                        },
                    },
                ],
            },

            /*
              STARTING FRAME

              Pull the opening ALL view back slightly and
              rotate west so the Americas become the first
              strong read instead of Africa / Europe.

              Estimated from the desired reference frame.
            */
            center:
                entryStage === "ready"
                    ? [-72, 14]
                    : [-101, 37],

            zoom:
                entryStage === "ready"
                    ? 1.66
                    : 3.55,

            pitch: 0,

            bearing: 0,

            minZoom: 0.8,

            maxZoom: DETAIL_MAX_ZOOM,

            attributionControl:
                false,

            dragRotate: true,

            touchZoomRotate: true,
        });

        mapRef.current = map;

        /* -----------------------------------------
           MAP LOAD
        ----------------------------------------- */

        map.on(
            "load",
            () => {
                map.setProjection({
                    type: "globe",
                });

                map.addSource(
                    "countries",
                    {
                        type: "geojson",

                        data:
                            "/data/world-countries.geojson",
                    }
                );

                const initialStyle =
                    atlasModeStyles.present;

                /* -------------------------------------
                   LAND
                ------------------------------------- */

                map.addLayer({
                    id: "land",

                    type: "fill",

                    source: "countries",

                    paint: {
                        "fill-color":
                            initialStyle.landColor,

                        "fill-opacity":
                            initialStyle.landOpacity,

                        "fill-color-transition": {
                            duration: 450,
                            delay: 0,
                        },

                        "fill-opacity-transition": {
                            duration: 450,
                            delay: 0,
                        },
                    },
                });

                /* -------------------------------------
                   LAND EDGE GLOW

                   Uses a wider blurred line beneath the
                   crisp edge. With the current countries
                   GeoJSON this follows polygon edges.
                   A dedicated coastline source can later
                   make this truly coast-only.
                ------------------------------------- */

                map.addLayer({
                    id: "land-glow",

                    type: "line",

                    source: "countries",

                    paint: {
                        "line-color":
                            NIGHT_GLOBE.coast,

                        "line-width": 3.6,

                        "line-blur": 2.4,

                        "line-opacity":
                            NIGHT_GLOBE.coastGlowOpacity,

                        "line-color-transition": {
                            duration: 450,
                            delay: 0,
                        },

                        "line-opacity-transition": {
                            duration: 450,
                            delay: 0,
                        },
                    },
                });

                /* -------------------------------------
                   CRISP LAND EDGE
                ------------------------------------- */

                map.addLayer({
                    id: "land-light",

                    type: "line",

                    source: "countries",

                    paint: {
                        "line-color":
                            NIGHT_GLOBE.coast,

                        "line-width": 1.05,

                        "line-opacity":
                            NIGHT_GLOBE.coastOpacity,

                        "line-color-transition": {
                            duration: 450,
                            delay: 0,
                        },

                        "line-opacity-transition": {
                            duration: 450,
                            delay: 0,
                        },
                    },
                });

                /* -------------------------------------
                   COUNTRY BORDERS
                ------------------------------------- */

                map.addLayer({
                    id: "country-borders",

                    type: "line",

                    source: "countries",

                    paint: {
                        "line-color":
                            NIGHT_GLOBE.country,

                        "line-width": 0.42,

                        "line-opacity":
                            NIGHT_GLOBE.countryOpacity,

                        "line-color-transition": {
                            duration: 450,
                            delay: 0,
                        },

                        "line-opacity-transition": {
                            duration: 450,
                            delay: 0,
                        },
                    },
                });


                /* -------------------------------------
                   DETAIL CITY STRUCTURE

                   OpenFreeMap / OpenMapTiles geometry.
                   We intentionally do NOT load a full
                   provider style because Life Atlas owns
                   the visual language.

                   No symbol layers are added, therefore
                   there are no street names, POIs,
                   businesses, transit labels, etc.
                ------------------------------------- */

                map.addSource(
                    "atlas-detail-map",
                    {
                        type: "vector",

                        url:
                            "https://tiles.openfreemap.org/planet",
                    }
                );

                map.addLayer({
                    id:
                        "atlas-detail-landuse",

                    type:
                        "fill",

                    source:
                        "atlas-detail-map",

                    "source-layer":
                        "landuse",

                    minzoom:
                        DETAIL_VIEW_ZOOM,

                    paint: {
                        "fill-color":
                            "#10241d",

                        "fill-opacity": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            DETAIL_VIEW_ZOOM,
                            0,
                            9,
                            0.16,
                            13,
                            0.28,
                        ],
                    },
                });

                map.addLayer({
                    id:
                        "atlas-detail-roads",

                    type:
                        "line",

                    source:
                        "atlas-detail-map",

                    "source-layer":
                        "transportation",

                    minzoom:
                        DETAIL_VIEW_ZOOM,

                    paint: {
                        "line-color":
                            "#7893a0",

                        "line-width": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            DETAIL_VIEW_ZOOM,
                            0.25,
                            10,
                            0.55,
                            13,
                            1.05,
                            16,
                            1.8,
                        ],

                        "line-opacity": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            DETAIL_VIEW_ZOOM,
                            0,
                            8,
                            0.18,
                            11,
                            0.34,
                            16,
                            0.48,
                        ],
                    },
                });

                map.addLayer({
                    id:
                        "atlas-detail-buildings",

                    type:
                        "fill",

                    source:
                        "atlas-detail-map",

                    "source-layer":
                        "building",

                    minzoom:
                        DETAIL_BUILDING_ZOOM,

                    paint: {
                        "fill-color":
                            "#17232b",

                        "fill-outline-color":
                            "#3b5968",

                        "fill-opacity": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            DETAIL_BUILDING_ZOOM,
                            0,
                            13,
                            0.34,
                            16,
                            0.58,
                        ],
                    },
                });


                /* -------------------------------------
                   PIN CLUSTER SOURCE

                   The existing DOM Pin markers remain
                   the final close-range representation.
                   This GeoJSON source gives Atlas a
                   zoom-aware navigation layer before
                   those Pins fully separate.
                ------------------------------------- */

                map.addSource(
                    "atlas-pin-clusters",
                    {
                        type: "geojson",

                        data: {
                            type:
                                "FeatureCollection",

                            features: [],
                        },

                        cluster:
                            true,

                        clusterRadius:
                            PIN_CLUSTER_RADIUS,

                        clusterMaxZoom:
                            PIN_CLUSTER_MAX_ZOOM,
                    }
                );

                map.addLayer({
                    id:
                        "atlas-pin-cluster-glow",

                    type:
                        "circle",

                    source:
                        "atlas-pin-clusters",

                    filter: [
                        "has",
                        "point_count",
                    ],

                    paint: {
                        "circle-radius": [
                            "step",
                            [
                                "get",
                                "point_count",
                            ],
                            11,
                            6,
                            13,
                            15,
                            16,
                        ],

                        "circle-color":
                            "rgba(7, 9, 13, 0.90)",

                        "circle-stroke-color":
                            "#ffd54a",

                        "circle-stroke-width":
                            1.4,

                        "circle-opacity":
                            0.96,

                        "circle-stroke-opacity":
                            0.88,
                    },
                });

                map.addLayer({
                    id:
                        "atlas-pin-cluster-count",

                    type:
                        "symbol",

                    source:
                        "atlas-pin-clusters",

                    filter: [
                        "has",
                        "point_count",
                    ],

                    layout: {
                        "text-field":
                            "{point_count_abbreviated}",

                        "text-size": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            1,
                            14,
                            5,
                            15,
                            9,
                            16,
                        ],

                        "text-font": [
                            "Open Sans Bold",
                        ],

                        "text-allow-overlap":
                            true,
                    },

                    paint: {
                        "text-color":
                            "#ffd54a",

                        "text-halo-color":
                            "#07090d",

                        "text-halo-width":
                            1.5,
                    },
                });

                const handleClusterClick =
                    async (
                        event:
                            MapMouseEvent
                    ) => {
                        const feature =
                            map.queryRenderedFeatures(
                                event.point,
                                {
                                    layers: [
                                        "atlas-pin-cluster-glow",
                                    ],
                                }
                            )[0];

                        if (!feature) {
                            return;
                        }

                        const clusterId =
                            Number(
                                feature.properties
                                    ?.cluster_id
                            );

                        const coordinates =
                            feature.geometry.type ===
                                "Point"
                                ? feature.geometry.coordinates
                                : null;

                        if (
                            !Number.isFinite(
                                clusterId
                            ) ||
                            !coordinates
                        ) {
                            return;
                        }

                        const source =
                            map.getSource(
                                "atlas-pin-clusters"
                            ) as
                            | GeoJSONSource
                            | undefined;

                        if (!source) {
                            return;
                        }

                        const expansionZoom =
                            await source.getClusterExpansionZoom(
                                clusterId
                            );

                        lastInteractionRef.current =
                            Date.now();

                        idleSpinSpeedRef.current =
                            0;

                        map.easeTo({
                            center: [
                                coordinates[0],
                                coordinates[1],
                            ],

                            zoom:
                                Math.min(
                                    DETAIL_MAX_ZOOM,
                                    Math.max(
                                        expansionZoom,
                                        map.getZoom() +
                                        1
                                    )
                                ),

                            duration:
                                720,

                            essential:
                                true,
                        });
                    };

                map.on(
                    "click",
                    "atlas-pin-cluster-glow",
                    handleClusterClick
                );

                map.on(
                    "click",
                    "atlas-pin-cluster-count",
                    handleClusterClick
                );

                const showPointer =
                    () => {
                        map.getCanvas().style.cursor =
                            "pointer";
                    };

                const restorePointer =
                    () => {
                        map.getCanvas().style.cursor =
                            isAddingPin ||
                                isRepositioningPin
                                ? "crosshair"
                                : "grab";
                    };

                map.on(
                    "mouseenter",
                    "atlas-pin-cluster-glow",
                    showPointer
                );

                map.on(
                    "mouseleave",
                    "atlas-pin-cluster-glow",
                    restorePointer
                );

            }
        );

        /* -----------------------------------------
           MAP ERRORS
        ----------------------------------------- */

        map.on(
            "error",
            (event) => {
                console.error(
                    "MapLibre error:",
                    event.error
                );
            }
        );

        /* -----------------------------------------
           CLEANUP
        ----------------------------------------- */

        return () => {
            savedMarkersRef.current.forEach(
                (marker) => {
                    marker.remove();
                }
            );

            draftMarkerRef.current?.remove();

            map.remove();

            mapRef.current =
                null;
        };
    }, []);

    /* =========================================
       LOGIN → ATLAS CAMERA

       Only camera mechanics live here.
       ALL / PAST / PRESENT / FUTURE styling
       remains exactly as it was.
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        if (
            entryStage ===
            "entering"
        ) {
            idleSpinSpeedRef.current =
                0;

            map.easeTo({
                center:
                    [-72, 14],

                zoom:
                    1.66,

                pitch:
                    0,

                bearing:
                    0,

                duration:
                    1750,

                easing:
                    (t) =>
                        1 -
                        Math.pow(
                            1 - t,
                            3
                        ),
            });

            return;
        }

        if (
            entryStage ===
            "ready"
        ) {
            /*
              Existing signed-in users can arrive
              from the brief "checking" state.
              Guarantee the normal Atlas frame.
            */

            if (
                map.getZoom() >
                2.3
            ) {
                map.jumpTo({
                    center:
                        [-72, 14],

                    zoom:
                        1.66,

                    pitch:
                        0,

                    bearing:
                        0,
                });
            }

            lastInteractionRef.current =
                Date.now();
        }
    }, [
        entryStage,
    ]);

    /* =========================================
       IDLE GLOBE SPIN
  
       - User control stops motion immediately.
       - Atlas waits 3 seconds after interaction.
       - Rotation then ramps up gently.
       - Final speed stays intentionally slow.
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        const container =
            mapContainerRef.current;

        if (
            !map ||
            !container
        ) {
            return;
        }

        const IDLE_DELAY_MS =
            3000;

        const RAMP_DURATION_MS =
            2200;

        /*
          Degrees of longitude per second.
    
          1.35° / second in the
          opposite direction =
          roughly one full revolution
          every 4.4 minutes.
        */

        const MAX_SPIN_SPEED =
            -1.35;

        const registerActivity =
            () => {
                lastInteractionRef.current =
                    Date.now();

                idleSpinSpeedRef.current =
                    0;
            };

        const beginInteraction =
            () => {
                isUserInteractingRef.current =
                    true;

                registerActivity();
            };

        const endInteraction =
            () => {
                isUserInteractingRef.current =
                    false;

                registerActivity();
            };

        const handleWheel =
            () => {
                registerActivity();
            };

        const handleKeyDown =
            () => {
                registerActivity();
            };

        /*
          Pointer events catch mouse,
          pen, and touch interaction
          before the idle engine can
          fight MapLibre's own controls.
        */

        container.addEventListener(
            "pointerdown",
            beginInteraction,
            {
                passive: true,
            }
        );

        window.addEventListener(
            "pointerup",
            endInteraction,
            {
                passive: true,
            }
        );

        window.addEventListener(
            "pointercancel",
            endInteraction,
            {
                passive: true,
            }
        );

        container.addEventListener(
            "wheel",
            handleWheel,
            {
                passive: true,
            }
        );

        container.addEventListener(
            "keydown",
            handleKeyDown
        );

        /*
          These MapLibre events cover
          interaction that may continue
          after the original pointer event.
        */

        map.on(
            "dragstart",
            beginInteraction
        );

        map.on(
            "dragend",
            endInteraction
        );

        map.on(
            "zoomstart",
            beginInteraction
        );

        map.on(
            "zoomend",
            endInteraction
        );

        map.on(
            "rotatestart",
            beginInteraction
        );

        map.on(
            "rotateend",
            endInteraction
        );

        map.on(
            "pitchstart",
            beginInteraction
        );

        map.on(
            "pitchend",
            endInteraction
        );

        const animate =
            (
                frameTime: number
            ) => {
                const previousFrameTime =
                    lastSpinFrameTimeRef.current;

                lastSpinFrameTimeRef.current =
                    frameTime;

                if (
                    previousFrameTime ===
                    null
                ) {
                    idleSpinFrameRef.current =
                        requestAnimationFrame(
                            animate
                        );

                    return;
                }

                const deltaSeconds =
                    Math.min(
                        0.05,
                        (
                            frameTime -
                            previousFrameTime
                        ) / 1000
                    );

                if (
                    entryStage ===
                    "entering"
                ) {
                    idleSpinSpeedRef.current =
                        0;

                    idleSpinFrameRef.current =
                        requestAnimationFrame(
                            animate
                        );

                    return;
                }

                /*
                  DETAIL VIEW is intentionally stable.
                  Once Atlas becomes a city / neighborhood
                  planning surface, the planet no longer
                  rotates underneath the user.
                */

                if (
                    map.getZoom() >=
                    DETAIL_VIEW_ZOOM
                ) {
                    idleSpinSpeedRef.current =
                        0;

                    idleSpinFrameRef.current =
                        requestAnimationFrame(
                            animate
                        );

                    return;
                }


                if (
                    isUserInteractingRef.current
                ) {
                    idleSpinSpeedRef.current =
                        0;

                    idleSpinFrameRef.current =
                        requestAnimationFrame(
                            animate
                        );

                    return;
                }

                const idleFor =
                    Date.now() -
                    lastInteractionRef.current;

                if (
                    idleFor <
                    IDLE_DELAY_MS
                ) {
                    idleSpinSpeedRef.current =
                        0;

                    idleSpinFrameRef.current =
                        requestAnimationFrame(
                            animate
                        );

                    return;
                }

                /*
                  Smoothstep gives the restart
                  a soft speed ramp rather than
                  suddenly beginning to rotate.
                */

                const rampProgress =
                    Math.min(
                        1,
                        (
                            idleFor -
                            IDLE_DELAY_MS
                        ) /
                        RAMP_DURATION_MS
                    );

                const easedRamp =
                    rampProgress *
                    rampProgress *
                    (
                        3 -
                        2 *
                        rampProgress
                    );

                idleSpinSpeedRef.current =
                    MAX_SPIN_SPEED *
                    easedRamp;

                const center =
                    map.getCenter();

                map.setCenter([
                    center.lng +
                    idleSpinSpeedRef.current *
                    deltaSeconds,
                    center.lat,
                ]);

                idleSpinFrameRef.current =
                    requestAnimationFrame(
                        animate
                    );
            };

        lastInteractionRef.current =
            Date.now();

        lastSpinFrameTimeRef.current =
            null;

        idleSpinSpeedRef.current =
            0;

        idleSpinFrameRef.current =
            requestAnimationFrame(
                animate
            );

        return () => {
            if (
                idleSpinFrameRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    idleSpinFrameRef.current
                );

                idleSpinFrameRef.current =
                    null;
            }

            container.removeEventListener(
                "pointerdown",
                beginInteraction
            );

            window.removeEventListener(
                "pointerup",
                endInteraction
            );

            window.removeEventListener(
                "pointercancel",
                endInteraction
            );

            container.removeEventListener(
                "wheel",
                handleWheel
            );

            container.removeEventListener(
                "keydown",
                handleKeyDown
            );

            map.off(
                "dragstart",
                beginInteraction
            );

            map.off(
                "dragend",
                endInteraction
            );

            map.off(
                "zoomstart",
                beginInteraction
            );

            map.off(
                "zoomend",
                endInteraction
            );

            map.off(
                "rotatestart",
                beginInteraction
            );

            map.off(
                "rotateend",
                endInteraction
            );

            map.off(
                "pitchstart",
                beginInteraction
            );

            map.off(
                "pitchend",
                endInteraction
            );
        };
    }, [
        entryStage,
    ]);

    /* =========================================
       SPATIAL WORKSPACE CAMERA
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        map.setPadding({
            top:
                Math.max(
                    0,
                    visualCenterYOffset * 2
                ),

            right:
                Math.max(
                    0,
                    workspaceRightInset
                ),

            bottom: 0,
            left: 0,
        });

        map.resize();
    }, [
        workspaceRightInset,
        visualCenterYOffset,
    ]);

    /* =========================================
       COLLECTION QUICK NAVIGATION
  
       A Pin selected from the Collection list
       gently swivels the globe to its location.
       User interaction and idle spin remain intact.
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (
            !map ||
            !focusPin ||
            focusRequestId <= 0
        ) {
            return;
        }

        lastInteractionRef.current =
            Date.now();

        idleSpinSpeedRef.current =
            0;

        map.easeTo({
            center: [
                focusPin.longitude,
                focusPin.latitude,
            ],

            zoom:
                Math.max(
                    map.getZoom(),
                    2.75
                ),

            duration:
                950,

            essential:
                true,
        });
    }, [
        focusPin,
        focusRequestId,
    ]);

    /* =========================================
       GOOGLE PLACE PREVIEW
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        if (
            placePreviewMarkerRef.current
        ) {
            placePreviewMarkerRef.current.remove();

            placePreviewMarkerRef.current =
                null;
        }

        if (!previewPlace) {
            return;
        }

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "atlas-marker atlas-marker--place-preview";

        const marker =
            new Marker({
                element,
                anchor: "center",
            })
                .setLngLat([
                    previewPlace.longitude,
                    previewPlace.latitude,
                ])
                .addTo(map);

        placePreviewMarkerRef.current =
            marker;

        lastInteractionRef.current =
            Date.now();

        idleSpinSpeedRef.current =
            0;

        map.easeTo({
            center: [
                previewPlace.longitude,
                previewPlace.latitude,
            ],

            zoom:
                Math.max(
                    map.getZoom(),
                    3.6
                ),

            duration:
                1050,

            essential:
                true,
        });

        return () => {
            if (
                placePreviewMarkerRef.current
            ) {
                placePreviewMarkerRef.current.remove();

                placePreviewMarkerRef.current =
                    null;
            }
        };
    }, [
        previewPlace,
        previewPlaceRequestId,
    ]);

    /* =========================================
       PIN PLACEMENT CLICK
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        const handleMapClick = (
            event: MapMouseEvent
        ) => {
            if (
                isRepositioningPin
            ) {
                onRepositionPin({
                    latitude:
                        event.lngLat.lat,

                    longitude:
                        event.lngLat.lng,
                });

                return;
            }

            if (!isAddingPin) {
                return;
            }

            onCreateDraftPin({
                latitude:
                    event.lngLat.lat,

                longitude:
                    event.lngLat.lng,
            });
        };

        map.on(
            "click",
            handleMapClick
        );

        return () => {
            map.off(
                "click",
                handleMapClick
            );
        };
    }, [
        isAddingPin,
        isRepositioningPin,
        onCreateDraftPin,
        onRepositionPin,
    ]);

    /* =========================================
       WORLD VISUAL STATE
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (
            !map ||
            !map.isStyleLoaded()
        ) {
            return;
        }

        if (
            !map.getLayer("land") ||
            !map.getLayer(
                "land-glow"
            ) ||
            !map.getLayer(
                "land-light"
            ) ||
            !map.getLayer(
                "country-borders"
            )
        ) {
            return;
        }

        /* -----------------------------------------
           ADD PIN MODE
    
           Gray land + muted blue ocean.
        ----------------------------------------- */

        if (
            isAddingPin ||
            isRepositioningPin
        ) {
            map.setPaintProperty(
                "space",
                "background-color",
                "#0b1a24"
            );

            map.setPaintProperty(
                "land",
                "fill-color",
                "#69727c"
            );

            map.setPaintProperty(
                "land",
                "fill-opacity",
                worldOverlayOpacity(
                    0.62
                )
            );

            map.setPaintProperty(
                "land-glow",
                "line-color",
                "#c6cdd3"
            );

            map.setPaintProperty(
                "land-glow",
                "line-opacity",
                worldOverlayOpacity(
                    0.08
                )
            );

            map.setPaintProperty(
                "land-light",
                "line-color",
                "#c6cdd3"
            );

            map.setPaintProperty(
                "land-light",
                "line-opacity",
                worldOverlayOpacity(
                    0.28
                )
            );

            map.setPaintProperty(
                "country-borders",
                "line-color",
                "#d7dde2"
            );

            map.setPaintProperty(
                "country-borders",
                "line-opacity",
                worldOverlayOpacity(
                    0.18
                )
            );

            map.getCanvas().style.cursor =
                "crosshair";

            return;
        }

        /* -----------------------------------------
           ALL — RETRO DIGITAL OVERVIEW

           No Day / Night interpretation.
           No atmosphere.
           Transparent map background lets the
           standard Atlas grid remain visible.
        ----------------------------------------- */

        if (
            worldState ===
            "all"
        ) {
            map.setSky(
                undefined as never
            );

            map.setPaintProperty(
                "space",
                "background-color",
                ALL_GLOBE.space
            );

            map.setPaintProperty(
                "land",
                "fill-color",
                ALL_GLOBE.land
            );

            map.setPaintProperty(
                "land",
                "fill-opacity",
                worldOverlayOpacity(
                    ALL_GLOBE.landOpacity
                )
            );

            map.setPaintProperty(
                "land-glow",
                "line-color",
                ALL_GLOBE.edge
            );

            map.setPaintProperty(
                "land-glow",
                "line-opacity",
                worldOverlayOpacity(
                    ALL_GLOBE.glowOpacity
                )
            );

            map.setPaintProperty(
                "land-light",
                "line-color",
                ALL_GLOBE.edge
            );

            map.setPaintProperty(
                "land-light",
                "line-opacity",
                worldOverlayOpacity(
                    ALL_GLOBE.edgeOpacity
                )
            );

            map.setPaintProperty(
                "country-borders",
                "line-color",
                ALL_GLOBE.country
            );

            map.setPaintProperty(
                "country-borders",
                "line-opacity",
                worldOverlayOpacity(
                    ALL_GLOBE.countryOpacity
                )
            );

            map.getCanvas().style.cursor =
                "grab";

            return;
        }

        /*
          Restore the atmospheric globe treatment
          whenever we leave ALL.
        */
        map.setSky({
            "sky-color":
                "rgba(0, 0, 0, 0)",

            "horizon-color":
                GLOBE_ATMOSPHERE.color,

            "sky-horizon-blend":
                GLOBE_ATMOSPHERE.horizonBlend,

            "horizon-fog-blend":
                GLOBE_ATMOSPHERE.horizonFogBlend,

            "fog-color":
                GLOBE_ATMOSPHERE.color,

            "fog-ground-blend":
                GLOBE_ATMOSPHERE.fogGroundBlend,

            "atmosphere-blend":
                GLOBE_ATMOSPHERE.atmosphereBlend,
        });

        /* -----------------------------------------
           NORMAL ATLAS STATE

           Geography now belongs to DAY / NIGHT,
           not PAST / PRESENT / FUTURE.
        ----------------------------------------- */

        const presentNight =
            atlasModeStyles.present;

        if (
            sceneMode ===
            "day"
        ) {
            map.setPaintProperty(
                "space",
                "background-color",
                DAY_GLOBE.water
            );

            map.setPaintProperty(
                "land",
                "fill-color",
                DAY_GLOBE.land
            );

            map.setPaintProperty(
                "land",
                "fill-opacity",
                worldOverlayOpacity(
                    DAY_GLOBE.landOpacity
                )
            );

            map.setPaintProperty(
                "land-glow",
                "line-color",
                DAY_GLOBE.coast
            );

            map.setPaintProperty(
                "land-glow",
                "line-opacity",
                worldOverlayOpacity(
                    DAY_GLOBE.coastGlowOpacity
                )
            );

            map.setPaintProperty(
                "land-light",
                "line-color",
                DAY_GLOBE.coast
            );

            map.setPaintProperty(
                "land-light",
                "line-opacity",
                worldOverlayOpacity(
                    DAY_GLOBE.coastOpacity
                )
            );

            map.setPaintProperty(
                "country-borders",
                "line-color",
                DAY_GLOBE.country
            );

            map.setPaintProperty(
                "country-borders",
                "line-opacity",
                worldOverlayOpacity(
                    DAY_GLOBE.countryOpacity
                )
            );
        } else {
            /*
              Every Night mode uses the exact same
              geography baseline as Present Night.
            */

            map.setPaintProperty(
                "space",
                "background-color",
                NIGHT_GLOBE.water
            );

            map.setPaintProperty(
                "land",
                "fill-color",
                presentNight.landColor
            );

            map.setPaintProperty(
                "land",
                "fill-opacity",
                worldOverlayOpacity(
                    presentNight.landOpacity
                )
            );

            map.setPaintProperty(
                "land-glow",
                "line-color",
                NIGHT_GLOBE.coast
            );

            map.setPaintProperty(
                "land-glow",
                "line-opacity",
                worldOverlayOpacity(
                    NIGHT_GLOBE.coastGlowOpacity
                )
            );

            map.setPaintProperty(
                "land-light",
                "line-color",
                NIGHT_GLOBE.coast
            );

            map.setPaintProperty(
                "land-light",
                "line-opacity",
                worldOverlayOpacity(
                    NIGHT_GLOBE.coastOpacity
                )
            );

            map.setPaintProperty(
                "country-borders",
                "line-color",
                NIGHT_GLOBE.country
            );

            map.setPaintProperty(
                "country-borders",
                "line-opacity",
                worldOverlayOpacity(
                    NIGHT_GLOBE.countryOpacity
                )
            );
        }

        /*
          DETAIL VIEW POLARITY

          At close zoom the physical map becomes the base.
          Night keeps the current luminous street skeleton.
          Day flips that skeleton darker so it remains crisp
          against the brighter environment instead of washing out.
        */
        if (
            map.getLayer(
                "atlas-detail-roads"
            )
        ) {
            map.setPaintProperty(
                "atlas-detail-roads",
                "line-color",
                sceneMode === "day"
                    ? "#163744"
                    : "#7893a0"
            );

            map.setPaintProperty(
                "atlas-detail-roads",
                "line-opacity",
                detailRoadOpacity(
                    sceneMode
                )
            );
        }

        if (
            map.getLayer(
                "atlas-detail-buildings"
            )
        ) {
            map.setPaintProperty(
                "atlas-detail-buildings",
                "fill-color",
                sceneMode === "day"
                    ? "#17302d"
                    : "#17232b"
            );

            map.setPaintProperty(
                "atlas-detail-buildings",
                "fill-outline-color",
                sceneMode === "day"
                    ? "#244b4f"
                    : "#3b5968"
            );
        }

        if (
            map.getLayer(
                "atlas-detail-landuse"
            )
        ) {
            map.setPaintProperty(
                "atlas-detail-landuse",
                "fill-color",
                sceneMode === "day"
                    ? "#173b31"
                    : "#10241d"
            );
        }

        map.getCanvas().style.cursor =
            "grab";
    }, [
        worldState,
        sceneMode,
        isAddingPin,
        isRepositioningPin,
    ]);

    /* =========================================
       CLUSTER DATA

       React remains the source of truth for Pins.
       MapLibre receives only the geographic subset
       needed for cluster navigation.
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        const syncPins =
            () => {
                const source =
                    map.getSource(
                        "atlas-pin-clusters"
                    ) as
                    | GeoJSONSource
                    | undefined;

                if (!source) {
                    return;
                }

                source.setData({
                    type:
                        "FeatureCollection",

                    features:
                        pins
                            .filter(
                                (pin) =>
                                    !(
                                        isRepositioningPin &&
                                        pin.id ===
                                        repositioningPinId
                                    )
                            )
                            .map(
                                (pin) => ({
                                    type:
                                        "Feature",

                                    properties: {
                                        pin_id:
                                            pin.id,
                                    },

                                    geometry: {
                                        type:
                                            "Point",

                                        coordinates: [
                                            pin.longitude,
                                            pin.latitude,
                                        ],
                                    },
                                })
                            ),
                });
            };

        if (
            map.isStyleLoaded()
        ) {
            syncPins();
            return;
        }

        map.once(
            "load",
            syncPins
        );

        return () => {
            map.off(
                "load",
                syncPins
            );
        };
    }, [
        pins,
        isRepositioningPin,
        repositioningPinId,
    ]);

    /* =========================================
       DOM PIN VISIBILITY

       Original Life Atlas DOM Pins are canonical
       at every zoom. MapLibre supplies cluster roots
       only. Individual Pins disappear only while
       they are actual members of a visible cluster.
    ========================================= */

    /* =========================================
       SAVED MARKERS
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        /* -----------------------------------------
           REMOVE OLD MARKERS
        ----------------------------------------- */

        savedMarkersRef.current.forEach(
            (marker) => {
                marker.remove();
            }
        );

        savedMarkersRef.current =
            [];

        /* -----------------------------------------
           BUILD CURRENT MARKERS
        ----------------------------------------- */

        pins.forEach((pin) => {
            if (
                isRepositioningPin &&
                pin.id ===
                repositioningPinId
            ) {
                return;
            }

            const element =
                document.createElement(
                    "button"
                );

            element.type =
                "button";

            /* ---------------------------------------
               CROSSROAD STATE
      
               2+ collection relationships
               automatically create the gold ring.
            --------------------------------------- */

            const isCrossroad =
                pin.collectionIds.length > 1;

            element.className = [
                "atlas-marker",

                `atlas-marker--${pin.timeState}`,

                isCrossroad
                    ? "atlas-marker--crossroad"
                    : "",
            ]
                .filter(Boolean)
                .join(" ");

            element.setAttribute(
                "aria-label",
                `Open ${pin.title}`
            );

            /*
              Keep the real Pin identity on the DOM marker.
              Clustering will hide only Pins that currently
              belong to a visible cluster.
            */
            element.dataset.pinId =
                pin.id;

            const hoverLabel =
                document.createElement(
                    "div"
                );

            hoverLabel.className =
                pin.coverImageUrl
                    ? "atlas-marker-label atlas-marker-label--with-image"
                    : "atlas-marker-label";

            hoverLabel.setAttribute(
                "aria-hidden",
                "true"
            );

            if (
                pin.coverImageUrl
            ) {
                const coverImage =
                    document.createElement(
                        "img"
                    );

                coverImage.className =
                    "atlas-marker-label-image";

                coverImage.src =
                    pin.coverImageUrl;

                coverImage.alt =
                    "";

                coverImage.loading =
                    "lazy";

                coverImage.decoding =
                    "async";

                hoverLabel.appendChild(
                    coverImage
                );

                const title =
                    document.createElement(
                        "span"
                    );

                title.className =
                    "atlas-marker-label-title";

                title.textContent =
                    pin.title;

                hoverLabel.appendChild(
                    title
                );
            } else {
                hoverLabel.textContent =
                    pin.title;
            }

            element.appendChild(
                hoverLabel
            );

            if (isCrossroad) {
                element.setAttribute(
                    "data-crossroad",
                    "true"
                );
            }

            /* ---------------------------------------
               SELECT SAVED PIN
            --------------------------------------- */

            element.addEventListener(
                "click",
                (event) => {
                    /*
                      Prevent the marker click from
                      reaching the MapLibre map.
          
                      Otherwise clicking an existing
                      pin during Add Pin mode could
                      create another draft underneath.
                    */

                    event.preventDefault();
                    event.stopPropagation();

                    onSelectPin(pin);
                }
            );

            /* ---------------------------------------
               CREATE MAPLIBRE MARKER
            --------------------------------------- */

            const marker =
                new Marker({
                    element,

                    anchor: "center",
                })
                    .setLngLat([
                        pin.longitude,
                        pin.latitude,
                    ])
                    .addTo(map);

            savedMarkersRef.current.push(
                marker
            );
        });

        /*
          CANONICAL SOLO PIN VISIBILITY

          Original DOM Pins remain the real solo Pin at every
          zoom level. MapLibre is used only for cluster roots.

          Below the cluster threshold we ask the clustered source
          which points are currently unclustered. Those Pins stay
          visible. Pins absorbed into a cluster are hidden until
          that cluster splits again.

          Above clusterMaxZoom every original Pin is shown.
        */
        const syncDomPinVisibility =
            () => {
                if (
                    map.getZoom() >
                    PIN_CLUSTER_MAX_ZOOM
                ) {
                    savedMarkersRef.current.forEach(
                        (marker) => {
                            marker
                                .getElement()
                                .style
                                .display =
                                "";
                        }
                    );

                    return;
                }

                const source =
                    map.getSource(
                        "atlas-pin-clusters"
                    );

                /*
                  Never blank Pins while the cluster source is
                  still loading. Keeping the DOM Pins visible is
                  the safe fallback and preserves the old Atlas
                  behavior during source refreshes.
                */
                if (
                    !source ||
                    !map.isSourceLoaded(
                        "atlas-pin-clusters"
                    )
                ) {
                    savedMarkersRef.current.forEach(
                        (marker) => {
                            marker
                                .getElement()
                                .style
                                .display =
                                "";
                        }
                    );

                    return;
                }

                const sourceFeatures =
                    map.querySourceFeatures(
                        "atlas-pin-clusters"
                    );

                const soloPinIds =
                    new Set<string>();

                sourceFeatures.forEach(
                    (feature) => {
                        /*
                          Cluster features have point_count.
                          Leaf / solo features retain pin_id.
                        */
                        if (
                            feature.properties
                                ?.point_count !==
                            undefined
                        ) {
                            return;
                        }

                        const pinId =
                            feature.properties
                                ?.pin_id;

                        if (
                            typeof pinId ===
                            "string"
                        ) {
                            soloPinIds.add(
                                pinId
                            );
                        }
                    }
                );

                /*
                  If tiles are between states, do not interpret an
                  empty query as "hide everything." Wait for the next
                  source/render event instead.
                */
                if (
                    sourceFeatures.length ===
                    0
                ) {
                    return;
                }

                savedMarkersRef.current.forEach(
                    (marker) => {
                        const element =
                            marker.getElement();

                        const pinId =
                            element.dataset
                                .pinId;

                        element.style.display =
                            pinId &&
                                soloPinIds.has(
                                    pinId
                                )
                                ? ""
                                : "none";
                    }
                );
            };

        const schedulePinVisibilitySync =
            () => {
                requestAnimationFrame(
                    syncDomPinVisibility
                );
            };

        syncDomPinVisibility();

        map.on(
            "zoomend",
            schedulePinVisibilitySync
        );

        map.on(
            "moveend",
            schedulePinVisibilitySync
        );

        map.on(
            "sourcedata",
            schedulePinVisibilitySync
        );

        return () => {
            map.off(
                "zoomend",
                schedulePinVisibilitySync
            );

            map.off(
                "moveend",
                schedulePinVisibilitySync
            );

            map.off(
                "sourcedata",
                schedulePinVisibilitySync
            );
        };
    }, [
        pins,
        onSelectPin,
        isRepositioningPin,
        repositioningPinId,
    ]);

    /* =========================================
       REPOSITION MARKER

       Direct drag or a globe click both update
       the same temporary position.
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        if (
            repositionMarkerRef.current
        ) {
            repositionMarkerRef.current.remove();

            repositionMarkerRef.current =
                null;
        }

        if (
            !isRepositioningPin ||
            !repositionPin
        ) {
            return;
        }

        const element =
            document.createElement(
                "button"
            );

        element.type =
            "button";

        element.className =
            "atlas-marker atlas-marker--reposition";

        element.setAttribute(
            "aria-label",
            "Move Pin"
        );

        element.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
            }
        );

        const marker =
            new Marker({
                element,

                anchor: "center",

                draggable: true,
            })
                .setLngLat([
                    repositionPin.longitude,
                    repositionPin.latitude,
                ])
                .addTo(map);

        marker.on(
            "dragend",
            () => {
                const next =
                    marker.getLngLat();

                onRepositionPin({
                    latitude:
                        next.lat,

                    longitude:
                        next.lng,
                });
            }
        );

        repositionMarkerRef.current =
            marker;

        return () => {
            marker.remove();

            if (
                repositionMarkerRef.current ===
                marker
            ) {
                repositionMarkerRef.current =
                    null;
            }
        };
    }, [
        isRepositioningPin,
        repositionPin,
        onRepositionPin,
    ]);


    /* =========================================
       DRAFT MARKER
    ========================================= */

    useEffect(() => {
        const map =
            mapRef.current;

        if (!map) {
            return;
        }

        /* -----------------------------------------
           REMOVE PREVIOUS DRAFT
        ----------------------------------------- */

        if (
            draftMarkerRef.current
        ) {
            draftMarkerRef.current.remove();

            draftMarkerRef.current =
                null;
        }

        /* -----------------------------------------
           NO DRAFT
        ----------------------------------------- */

        if (!draftPin) {
            return;
        }

        /* -----------------------------------------
           CREATE DRAFT MARKER
        ----------------------------------------- */

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "atlas-marker atlas-marker--draft";

        const marker =
            new Marker({
                element,

                anchor: "center",
            })
                .setLngLat([
                    draftPin.longitude,
                    draftPin.latitude,
                ])
                .addTo(map);

        draftMarkerRef.current =
            marker;
    }, [
        draftPin,
    ]);

    /* =========================================
       RENDER
    ========================================= */

    return (
        <div
            ref={
                mapContainerRef
            }
            className="atlas-globe"
        />
    );
}