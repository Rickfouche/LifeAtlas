import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
  params: Promise<{
    momentId: string;
  }>;
};

/* =========================================
   HELPERS
========================================= */

function normalizeNullableString(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed || null;
}

function isMomentType(
  value: unknown
): value is
  | "date"
  | "datetime"
  | "range" {
  return (
    value === "date" ||
    value === "datetime" ||
    value === "range"
  );
}

/* =========================================
   PATCH
   Update a moment
========================================= */

export async function PATCH(
  request: Request,
  context: RouteContext
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

    const {
      momentId,
    } =
      await context.params;

    if (!momentId) {
      return NextResponse.json(
        {
          error:
            "Moment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: currentMoment,
      error: momentError,
    } = await supabase
      .from("pin_moments")
      .select(`
        id,
        pin_id,
        title,
        moment_type,
        start_at,
        end_at,
        timezone,
        notes,
        metadata
      `)
      .eq(
        "id",
        momentId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      momentError ||
      !currentMoment
    ) {
      return NextResponse.json(
        {
          error:
            "Moment not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const nextMomentType =
      body.momentType !==
        undefined
        ? body.momentType
        : currentMoment.moment_type;

    if (
      !isMomentType(
        nextMomentType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid moment type.",
        },
        {
          status: 400,
        }
      );
    }

    const nextTitle =
      body.title !==
        undefined
        ? normalizeNullableString(
            body.title
          )
        : currentMoment.title;

    const nextTimezone =
      body.timezone !==
        undefined
        ? normalizeNullableString(
            body.timezone
          )
        : currentMoment.timezone;

    const nextNotes =
      body.notes !==
        undefined
        ? normalizeNullableString(
            body.notes
          )
        : currentMoment.notes;

    const nextMetadata =
      body.metadata !==
        undefined
        ? body.metadata &&
          typeof body.metadata ===
            "object" &&
          !Array.isArray(
            body.metadata
          )
          ? body.metadata
          : {}
        : currentMoment.metadata;

    const nextStartRaw =
      body.startAt !==
        undefined
        ? body.startAt
        : currentMoment.start_at;

    if (
      typeof nextStartRaw !==
      "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Start date is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const startDate =
      new Date(
        nextStartRaw
      );

    if (
      Number.isNaN(
        startDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Start date is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    let normalizedEndAt:
      string | null =
      null;

    if (
      nextMomentType ===
      "range"
    ) {
      const nextEndRaw =
        body.endAt !==
          undefined
          ? body.endAt
          : currentMoment.end_at;

      if (
        typeof nextEndRaw !==
        "string" ||
        !nextEndRaw.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "End date is required for a range.",
          },
          {
            status: 400,
          }
        );
      }

      const endDate =
        new Date(
          nextEndRaw
        );

      if (
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            error:
              "End date is invalid.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        endDate.getTime() <
        startDate.getTime()
      ) {
        return NextResponse.json(
          {
            error:
              "End date cannot be before start date.",
          },
          {
            status: 400,
          }
        );
      }

      normalizedEndAt =
        endDate.toISOString();
    }

    const {
      data: moment,
      error: updateError,
    } = await supabase
      .from("pin_moments")
      .update({
        title:
          nextTitle,

        moment_type:
          nextMomentType,

        start_at:
          startDate.toISOString(),

        end_at:
          normalizedEndAt,

        timezone:
          nextTimezone,

        notes:
          nextNotes,

        metadata:
          nextMetadata,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        momentId
      )
      .eq(
        "user_id",
        user.id
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
      .single();

    if (
      updateError ||
      !moment
    ) {
      console.error(
        "Could not update pin moment:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Could not update moment.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        moment,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas pin moment PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected moment update error.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   DELETE
   Delete a moment only
========================================= */

export async function DELETE(
  _request: Request,
  context: RouteContext
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

    const {
      momentId,
    } =
      await context.params;

    if (!momentId) {
      return NextResponse.json(
        {
          error:
            "Moment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: moment,
      error: momentError,
    } = await supabase
      .from("pin_moments")
      .select(`
        id,
        title
      `)
      .eq(
        "id",
        momentId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      momentError ||
      !moment
    ) {
      return NextResponse.json(
        {
          error:
            "Moment not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from("pin_moments")
      .delete()
      .eq(
        "id",
        momentId
      )
      .eq(
        "user_id",
        user.id
      );

    if (deleteError) {
      console.error(
        "Could not delete pin moment:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Could not delete moment.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        momentId,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas pin moment DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected moment deletion error.",
      },
      {
        status: 500,
      }
    );
  }
}