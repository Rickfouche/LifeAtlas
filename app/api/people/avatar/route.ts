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

const BUNNY_CDN_URL =
  process.env.NEXT_PUBLIC_BUNNY_CDN_URL;

/* =========================================
   HELPERS
========================================= */

function sanitizeFileName(
  value: string
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    ) || "avatar";
}

/* =========================================
   POST
   Upload Person avatar to Bunny

   This stores the image as a Person asset,
   not as Pin media/content.
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
      !BUNNY_STORAGE_ZONE ||
      !BUNNY_STORAGE_ACCESS_KEY ||
      !BUNNY_STORAGE_ENDPOINT ||
      !BUNNY_CDN_URL
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

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Image file is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Person photo must be an image.",
        },
        {
          status: 400,
        }
      );
    }

    const maxBytes =
      10 * 1024 * 1024;

    if (
      file.size >
      maxBytes
    ) {
      return NextResponse.json(
        {
          error:
            "Person photo must be under 10 MB.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanedName =
      sanitizeFileName(
        file.name
      );

    const storagePath =
      `people/${user.id}/${crypto.randomUUID()}-${cleanedName}`;

    const endpoint =
      BUNNY_STORAGE_ENDPOINT.replace(
        /\/$/,
        ""
      );

    const encodedPath =
      storagePath
        .split("/")
        .map(
          (
            segment
          ) =>
            encodeURIComponent(
              segment
            )
        )
        .join("/");

    const uploadUrl =
      `${endpoint}/${BUNNY_STORAGE_ZONE}/${encodedPath}`;

    const buffer =
      await file.arrayBuffer();

    const bunnyResponse =
      await fetch(
        uploadUrl,
        {
          method:
            "PUT",

          headers: {
            AccessKey:
              BUNNY_STORAGE_ACCESS_KEY,

            "Content-Type":
              file.type ||
              "application/octet-stream",
          },

          body:
            buffer,
        }
      );

    if (
      !bunnyResponse.ok
    ) {
      const bunnyError =
        await bunnyResponse.text();

      console.error(
        "Bunny Person avatar upload failed:",
        bunnyResponse.status,
        bunnyError
      );

      return NextResponse.json(
        {
          error:
            "Could not upload person photo.",
        },
        {
          status: 502,
        }
      );
    }

    const cdnBase =
      BUNNY_CDN_URL.replace(
        /\/$/,
        ""
      );

    const avatarUrl =
      `${cdnBase}/${storagePath}`;

    return NextResponse.json(
      {
        avatarUrl,
        storagePath,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Atlas Person avatar POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected person photo upload error.",
      },
      {
        status: 500,
      }
    );
  }
}