import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
  params: Promise<{
    pinId: string;
  }>;
};

/* =========================================
   GET
   Load every Task relationship for a Pin.

   moment_id = null
   → general / ALL task

   moment_id = UUID
   → task belongs to that Moment

   AtlasPanel will apply the same Moment
   filtering model used by Content + People.
========================================= */

export async function GET(
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

    const { pinId } =
      await context.params;

    if (!pinId) {
      return NextResponse.json(
        {
          error:
            "Pin ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       VERIFY PIN OWNERSHIP
    ========================================= */

    const {
      data: pin,
      error: pinError,
    } = await supabase
      .from("pins")
      .select("id")
      .eq(
        "id",
        pinId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      pinError ||
      !pin
    ) {
      return NextResponse.json(
        {
          error:
            "Pin not found.",
        },
        {
          status: 404,
        }
      );
    }

    /* =========================================
       LOAD TASKS
    ========================================= */

    const {
      data: tasks,
      error: tasksError,
    } = await supabase
      .from("pin_tasks")
      .select(`
        id,
        pin_id,
        moment_id,
        title,
        is_complete,
        completed_at,
        created_at,
        updated_at
      `)
      .eq(
        "pin_id",
        pinId
      )
      .eq(
        "user_id",
        user.id
      )
      .order(
        "is_complete",
        {
          ascending: true,
        }
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (tasksError) {
      console.error(
        "Could not load Pin tasks:",
        tasksError
      );

      return NextResponse.json(
        {
          error:
            "Could not load tasks for this Pin.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        tasks:
          tasks ??
          [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas Pin tasks GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected task loading error.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   POST
   Create a Task inside the current Pin state.

   Body:
   {
     title: string,
     momentId?: string | null
   }

   momentId = null
   → general / ALL task

   momentId = UUID
   → dated Moment task
========================================= */

export async function POST(
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

    const { pinId } =
      await context.params;

    if (!pinId) {
      return NextResponse.json(
        {
          error:
            "Pin ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const title =
      typeof body.title ===
        "string"
        ? body.title.trim()
        : "";

    const momentId =
      typeof body.momentId ===
        "string" &&
      body.momentId.trim()
        ? body.momentId.trim()
        : null;

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Task title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      title.length > 50
    ) {
      return NextResponse.json(
        {
          error:
            "Tasks must be 50 characters or fewer.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       VERIFY PIN OWNERSHIP
    ========================================= */

    const {
      data: pin,
      error: pinError,
    } = await supabase
      .from("pins")
      .select("id")
      .eq(
        "id",
        pinId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      pinError ||
      !pin
    ) {
      return NextResponse.json(
        {
          error:
            "Pin not found.",
        },
        {
          status: 404,
        }
      );
    }

    /* =========================================
       VERIFY OPTIONAL MOMENT

       Moment must belong to this exact Pin.
    ========================================= */

    if (momentId) {
      const {
        data: moment,
        error: momentError,
      } = await supabase
        .from("pin_moments")
        .select("id")
        .eq(
          "id",
          momentId
        )
        .eq(
          "pin_id",
          pinId
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
              "Moment not found for this Pin.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* =========================================
       CREATE TASK
    ========================================= */

    const {
      data: task,
      error: createError,
    } = await supabase
      .from("pin_tasks")
      .insert({
        user_id:
          user.id,

        pin_id:
          pinId,

        moment_id:
          momentId,

        title,

        is_complete:
          false,

        completed_at:
          null,
      })
      .select(`
        id,
        pin_id,
        moment_id,
        title,
        is_complete,
        completed_at,
        created_at,
        updated_at
      `)
      .single();

    if (
      createError ||
      !task
    ) {
      console.error(
        "Could not create Pin task:",
        createError
      );

      return NextResponse.json(
        {
          error:
            "Could not create task.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        task,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Atlas Pin tasks POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected task creation error.",
      },
      {
        status: 500,
      }
    );
  }
}