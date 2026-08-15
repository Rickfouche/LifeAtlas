export type AtlasWorldState =
    | "all"
    | "past"
    | "present"
    | "future";

export type AtlasTimeState =
    | "past"
    | "present"
    | "future";

export type AtlasCollection = {
    id: string;
    name: string;
};


export type AtlasPersonRelationshipState =
    | "active"
    | "hiatus"
    | "dormant"
    | "potential"
    | "archived";

export type AtlasPerson = {
    id: string;

    name: string;

    avatar_url: string | null;

    headline: string | null;
    company: string | null;
    city: string | null;

    phone: string | null;
    email: string | null;
    website: string | null;

    birthday: string | null;

    roles: string[];
    tags: string[];

    relationship_state:
    AtlasPersonRelationshipState;

    social_links:
    Record<string, unknown>;

    notes: string | null;

    metadata:
    Record<string, unknown>;

    created_at: string;
    updated_at: string;
};


export type AtlasPlaceSearchResult = {
    id: string;
    name: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    primaryType: string | null;
};


export type AtlasPinMoment = {
    id: string;
    pin_id: string;

    title: string | null;

    moment_type:
    | "date"
    | "datetime"
    | "range";

    start_at: string;
    end_at: string | null;

    timezone: string | null;
    notes: string | null;

    cover_media_id: string | null;

    metadata:
    Record<string, unknown>;

    created_at: string;
    updated_at: string;
};


export type AtlasPin = {
    id: string;
    title: string;

    latitude: number;
    longitude: number;

    timeState: AtlasTimeState;

    collectionIds: string[];

    description?: string;
    notes?: string;

    placeProvider?: "google";
    externalPlaceId?: string;
    formattedAddress?: string;
    placeType?: string;

    coverMediaId?: string | null;

    // Resolved display URL for the optional
    // parent Pin cover. Not persisted on pins.
    coverImageUrl?: string | null;
};


export type AtlasDraftPin = {
    latitude: number;
    longitude: number;

    title?: string;

    placeProvider?: "google";
    externalPlaceId?: string;
    formattedAddress?: string;
    placeType?: string;
};