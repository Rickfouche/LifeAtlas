import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   GOOGLE PLACES
========================================= */

const GOOGLE_PLACES_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY;

const GOOGLE_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

/* =========================================
   TYPES
========================================= */

type GooglePlace = {
  id?: string;

  displayName?: {
    text?: string;
    languageCode?: string;
  };

  formattedAddress?: string;

  location?: {
    latitude?: number;
    longitude?: number;
  };

  primaryType?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

/* =========================================
   POST
   Search Google Places

   Body:
   {
     query: string
   }
========================================= */

export async function POST(
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

    if (
      !GOOGLE_PLACES_API_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "Google Places API key is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const query =
      typeof body.query ===
        "string"
        ? body.query.trim()
        : "";

    if (
      query.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Enter at least 2 characters to search.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       GOOGLE TEXT SEARCH (NEW)

       We only request the fields Atlas
       currently needs.

       This keeps the response smaller and
       avoids requesting unrelated data.
    ========================================= */

    const googleResponse =
      await fetch(
        GOOGLE_TEXT_SEARCH_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-Goog-Api-Key":
              GOOGLE_PLACES_API_KEY,

            "X-Goog-FieldMask":
              [
                "places.id",
                "places.displayName",
                "places.formattedAddress",
                "places.location",
                "places.primaryType",
              ].join(","),
          },

          body:
            JSON.stringify({
              textQuery:
                query,

              pageSize:
                8,
            }),

          cache:
            "no-store",
        }
      );

    const googleResult =
      (await googleResponse.json()) as
        GooglePlacesResponse & {
          error?: {
            message?: string;
            status?: string;
          };
        };

    if (
      !googleResponse.ok
    ) {
      console.error(
        "Google Places search failed:",
        googleResponse.status,
        googleResult
      );

      return NextResponse.json(
        {
          error:
            googleResult.error?.message ??
            "Google Places search failed.",
        },
        {
          status:
            googleResponse.status,
        }
      );
    }

    /* =========================================
       GOOGLE → LIFE ATLAS

       Normalize Google data here so the
       client never has to understand Google's
       raw response shape.
    ========================================= */

    const places =
      (
        googleResult.places ??
        []
      )
        .filter(
          (place) =>
            place.id &&
            place.displayName?.text &&
            typeof place.location
              ?.latitude ===
              "number" &&
            typeof place.location
              ?.longitude ===
              "number"
        )
        .map(
          (place) => ({
            id:
              place.id as string,

            name:
              place.displayName
                ?.text as string,

            formattedAddress:
              place.formattedAddress ??
              "",

            latitude:
              place.location
                ?.latitude as number,

            longitude:
              place.location
                ?.longitude as number,

            primaryType:
              place.primaryType ??
              null,
          })
        );

    return NextResponse.json(
      {
        places,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas Google Places search error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected place search error.",
      },
      {
        status: 500,
      }
    );
  }
}