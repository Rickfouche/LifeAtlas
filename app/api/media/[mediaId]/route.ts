import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   BUNNY CONFIG
========================================= */

const BUNNY_STORAGE_ZONE =
  process.env.BUNNY_STORAGE_ZONE;

const BUNNY_STORAGE_ACCESS_KEY =
  process.env.BUNNY_STORAGE_ACCESS_KEY;

const BUNNY_STORAGE_ENDPOINT =
  process.env.BUNNY_STORAGE_ENDPOINT;

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
  params: Promise<{
    mediaId: string;
  }>;
};

/* =========================================
   PATCH

   Supports:
   - rename
   - move into folder
   - move back to loose content
   - attach to a Pin Moment
   - return to general pin content

   Folder moves preserve temporal integrity:
   moving into a folder adopts that folder's
   moment_id automatically.
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

    const { mediaId } =
      await context.params;

    if (!mediaId) {
      return NextResponse.json(
        {
          error:
            "Media ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: currentMedia,
      error: mediaError,
    } = await supabase
      .from("media")
      .select(`
        id,
        pin_id,
        folder_id,
        moment_id,
        name,
        provider,
        source_type,
        storage_path
      `)
      .eq(
        "id",
        mediaId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      mediaError ||
      !currentMedia
    ) {
      return NextResponse.json(
        {
          error:
            "Content not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const updates:
      Record<string, unknown> = {
        updated_at:
          new Date().toISOString(),
      };

    /* =========================================
       RENAME
    ========================================= */

    if (
      body.name !== undefined
    ) {
      const name =
        typeof body.name ===
          "string"
          ? body.name.trim()
          : "";

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Content name is required.",
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
              "Content name is too long.",
          },
          {
            status: 400,
          }
        );
      }

      updates.name =
        name;
    }

    /* =========================================
       MOMENT
    ========================================= */

    if (
      body.momentId !==
      undefined
    ) {
      const momentId =
        typeof body.momentId ===
          "string" &&
        body.momentId.trim()
          ? body.momentId.trim()
          : null;

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
            currentMedia.pin_id
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

      updates.moment_id =
        momentId;

      /*
        A folder belongs to one temporal
        context. If content is explicitly
        reassigned to another Moment, it
        becomes loose content in that state.
      */

      if (
        currentMedia.folder_id
      ) {
        const {
          data: currentFolder,
        } = await supabase
          .from("media_folders")
          .select(`
            id,
            moment_id
          `)
          .eq(
            "id",
            currentMedia.folder_id
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

        if (
          currentFolder &&
          currentFolder.moment_id !==
            momentId
        ) {
          updates.folder_id =
            null;
        }
      }
    }

    /* =========================================
       FOLDER MOVE
    ========================================= */

    if (
      body.folderId !==
      undefined
    ) {
      const folderId =
        typeof body.folderId ===
          "string" &&
        body.folderId.trim()
          ? body.folderId.trim()
          : null;

      if (!folderId) {
        updates.folder_id =
          null;
      } else {
        const {
          data: folder,
          error: folderError,
        } = await supabase
          .from("media_folders")
          .select(`
            id,
            pin_id,
            moment_id
          `)
          .eq(
            "id",
            folderId
          )
          .eq(
            "pin_id",
            currentMedia.pin_id
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
                "Folder not found for this pin.",
            },
            {
              status: 400,
            }
          );
        }

        updates.folder_id =
          folder.id;

        /*
          Moving into a folder also moves
          content into that folder's Moment.
        */

        updates.moment_id =
          folder.moment_id;
      }
    }

    const {
      data: media,
      error: updateError,
    } = await supabase
      .from("media")
      .update(
        updates
      )
      .eq(
        "id",
        mediaId
      )
      .eq(
        "user_id",
        user.id
      )
      .select(`
        id,
        pin_id,
        folder_id,
        moment_id,
        name,
        original_name,
        source_type,
        provider,
        storage_path,
        media_type,
        mime_type,
        file_size,
        external_url,
        external_id,
        thumbnail_url,
        metadata,
        created_at,
        updated_at
      `)
      .single();

    if (
      updateError ||
      !media
    ) {
      console.error(
        "Media update failed:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Could not update content.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        media,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas media PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected content update error.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   DELETE

   Preserves existing behavior:
   - remove Bunny upload from storage
   - delete media row
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

    const { mediaId } =
      await context.params;

    if (!mediaId) {
      return NextResponse.json(
        {
          error:
            "Media ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: media,
      error: mediaError,
    } = await supabase
      .from("media")
      .select(`
        id,
        name,
        provider,
        source_type,
        storage_path
      `)
      .eq(
        "id",
        mediaId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      mediaError ||
      !media
    ) {
      return NextResponse.json(
        {
          error:
            "Content not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      media.provider ===
        "bunny" &&
      media.source_type ===
        "upload" &&
      media.storage_path
    ) {
      if (
        !BUNNY_STORAGE_ZONE ||
        !BUNNY_STORAGE_ACCESS_KEY ||
        !BUNNY_STORAGE_ENDPOINT
      ) {
        return NextResponse.json(
          {
            error:
              "Bunny storage configuration is incomplete.",
          },
          {
            status: 500,
          }
        );
      }

      const endpoint =
        BUNNY_STORAGE_ENDPOINT.replace(
          /\/$/,
          ""
        );

      const storagePath =
        media.storage_path
          .split("/")
          .map(
            (
              segment: string
            ) =>
              encodeURIComponent(
                segment
              )
          )
          .join("/");

      const deleteUrl =
        `${endpoint}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

      const bunnyResponse =
        await fetch(
          deleteUrl,
          {
            method:
              "DELETE",

            headers: {
              AccessKey:
                BUNNY_STORAGE_ACCESS_KEY,
            },
          }
        );

      if (
        !bunnyResponse.ok &&
        bunnyResponse.status !==
          404
      ) {
        const bunnyError =
          await bunnyResponse.text();

        console.error(
          "Bunny media deletion failed:",
          bunnyResponse.status,
          bunnyError
        );

        return NextResponse.json(
          {
            error:
              "Could not delete uploaded file from storage.",
          },
          {
            status: 502,
          }
        );
      }
    }

    const {
      error: deleteError,
    } = await supabase
      .from("media")
      .delete()
      .eq(
        "id",
        mediaId
      )
      .eq(
        "user_id",
        user.id
      );

    if (deleteError) {
      console.error(
        "Media row deletion failed:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Could not delete content.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        mediaId,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas media DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected content deletion error.",
      },
      {
        status: 500,
      }
    );
  }
}