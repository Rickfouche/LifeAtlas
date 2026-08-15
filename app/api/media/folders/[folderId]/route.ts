import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
  params: Promise<{
    folderId: string;
  }>;
};

/* =========================================
   PATCH
   Rename folder
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

    const { folderId } =
      await context.params;

    if (!folderId) {
      return NextResponse.json(
        {
          error:
            "Folder ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const name =
      typeof body.name ===
        "string"
        ? body.name.trim()
        : "";

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

    const {
      data: folder,
      error: folderError,
    } = await supabase
      .from("media_folders")
      .update({
        name,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        folderId
      )
      .eq(
        "user_id",
        user.id
      )
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
        "Folder rename failed:",
        folderError
      );

      return NextResponse.json(
        {
          error:
            "Folder not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        folder,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas folder PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected folder update error.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   DELETE
   Delete folder only

   Media rows survive because folder_id
   uses ON DELETE SET NULL.
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

    const { folderId } =
      await context.params;

    if (!folderId) {
      return NextResponse.json(
        {
          error:
            "Folder ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: folder,
      error: folderError,
    } = await supabase
      .from("media_folders")
      .select(`
        id,
        name
      `)
      .eq(
        "id",
        folderId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      folderError ||
      !folder
    ) {
      return NextResponse.json(
        {
          error:
            "Folder not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from("media_folders")
      .delete()
      .eq(
        "id",
        folderId
      )
      .eq(
        "user_id",
        user.id
      );

    if (deleteError) {
      console.error(
        "Folder deletion failed:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Could not delete folder.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        folderId,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas folder DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected folder deletion error.",
      },
      {
        status: 500,
      }
    );
  }
}