import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   GET
   Load folders for a pin
========================================= */

export async function GET(
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

    const url =
      new URL(request.url);

    const pinId =
      url.searchParams.get(
        "pinId"
      );

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

    /* -----------------------------------------
       VERIFY PIN OWNERSHIP
    ----------------------------------------- */

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

    /* -----------------------------------------
       LOAD FOLDERS
    ----------------------------------------- */

    const {
      data: folders,
      error: folderError,
    } = await supabase
      .from("media_folders")
      .select(`
        id,
        pin_id,
        moment_id,
        name,
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
        "created_at",
        {
          ascending: true,
        }
      );

    if (folderError) {
      console.error(
        "Could not load media folders:",
        folderError
      );

      return NextResponse.json(
        {
          error:
            "Could not load folders.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        folders:
          folders ?? [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas folder GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected folder loading error.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   POST
   Create folder inside a pin
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

    const body =
      await request.json();

    const pinId =
      typeof body.pinId ===
        "string"
        ? body.pinId.trim()
        : "";

    const name =
      typeof body.name ===
        "string"
        ? body.name.trim()
        : "";


    const momentId =
      typeof body.momentId ===
        "string" &&
      body.momentId.trim()
        ? body.momentId.trim()
        : null;

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

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Folder name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      name.length > 255
    ) {
      return NextResponse.json(
        {
          error:
            "Folder name is too long.",
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------
       VERIFY PIN OWNERSHIP
    ----------------------------------------- */

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

    /* -----------------------------------------
       VERIFY OPTIONAL MOMENT
    ----------------------------------------- */

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
              "Moment not found for this pin.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* -----------------------------------------
       CREATE FOLDER
    ----------------------------------------- */

    const {
      data: folder,
      error: folderError,
    } = await supabase
      .from("media_folders")
      .insert({
        user_id:
          user.id,

        pin_id:
          pinId,

        moment_id:
          momentId,

        name,
      })
      .select(`
        id,
        pin_id,
        moment_id,
        name,
        created_at,
        updated_at
      `)
      .single();

    if (
      folderError ||
      !folder
    ) {
      console.error(
        "Could not create media folder:",
        folderError
      );

      return NextResponse.json(
        {
          error:
            "Could not create folder.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        folder,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Atlas folder POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected folder creation error.",
      },
      {
        status: 500,
      }
    );
  }
}