import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   CONFIG
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
   TEMP V1 LIMIT
   Small-file proof before large-media work
========================================= */

const MAX_FILE_SIZE =
    25 * 1024 * 1024;

/* =========================================
   MEDIA TYPE DETECTION
========================================= */

function getMediaType(
    mimeType: string
):
    | "image"
    | "audio"
    | "video"
    | "pdf"
    | "file" {
    if (
        mimeType.startsWith("image/")
    ) {
        return "image";
    }

    if (
        mimeType.startsWith("audio/")
    ) {
        return "audio";
    }

    if (
        mimeType.startsWith("video/")
    ) {
        return "video";
    }

    if (
        mimeType === "application/pdf"
    ) {
        return "pdf";
    }

    return "file";
}

/* =========================================
   FILE EXTENSION
========================================= */

function getExtension(
    filename: string
) {
    const lastDot =
        filename.lastIndexOf(".");

    if (
        lastDot === -1
    ) {
        return "";
    }

    return filename
        .slice(lastDot)
        .toLowerCase()
        .replace(
            /[^a-z0-9.]/g,
            ""
        );
}

/* =========================================
   POST
========================================= */

export async function POST(
    request: Request
) {
    try {
        /* -----------------------------------------
           ENV CHECK
        ----------------------------------------- */

        if (
            !BUNNY_STORAGE_ZONE ||
            !BUNNY_STORAGE_ACCESS_KEY ||
            !BUNNY_STORAGE_ENDPOINT ||
            !BUNNY_CDN_URL
        ) {
            console.error(
                "Missing Bunny environment variables."
            );

            return NextResponse.json(
                {
                    error:
                        "Media storage is not configured.",
                },
                {
                    status: 500,
                }
            );
        }

        /* -----------------------------------------
           AUTHENTICATE USER
        ----------------------------------------- */

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

        /* -----------------------------------------
           READ FORM DATA
        ----------------------------------------- */

        const formData =
            await request.formData();

        const file =
            formData.get("file");

        const pinId =
            formData.get("pinId");

        const folderId =
            formData.get("folderId");

        if (
            !(file instanceof File)
        ) {
            return NextResponse.json(
                {
                    error:
                        "No file received.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            typeof pinId !==
            "string" ||
            !pinId
        ) {
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
           TEMP FILE SIZE GUARD
        ----------------------------------------- */

        if (
            file.size >
            MAX_FILE_SIZE
        ) {
            return NextResponse.json(
                {
                    error:
                        "For this first media test, files must be 25 MB or smaller.",
                },
                {
                    status: 413,
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
           VERIFY OPTIONAL FOLDER
        ----------------------------------------- */

        let validFolderId:
            string | null = null;

        if (
            typeof folderId ===
            "string" &&
            folderId
        ) {
            const {
                data: folder,
                error: folderError,
            } = await supabase
                .from(
                    "media_folders"
                )
                .select("id")
                .eq(
                    "id",
                    folderId
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
                folderError ||
                !folder
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Media folder not found.",
                    },
                    {
                        status: 404,
                    }
                );
            }

            validFolderId =
                folder.id;
        }

        /* -----------------------------------------
           CREATE STORAGE PATH
    
           Bunny:
           USER_UUID / PIN_UUID / FILE_UUID.ext
        ----------------------------------------- */

        const extension =
            getExtension(
                file.name
            );

        const storedFilename =
            `${crypto.randomUUID()}${extension}`;

        const storagePath =
            `${user.id}/${pinId}/${storedFilename}`;

        const bunnyUploadUrl =
            `${BUNNY_STORAGE_ENDPOINT.replace(
                /\/$/,
                ""
            )}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

        /* -----------------------------------------
           FILE -> RAW BYTES
        ----------------------------------------- */

        const fileBuffer =
            await file.arrayBuffer();

        /* -----------------------------------------
           UPLOAD TO BUNNY
        ----------------------------------------- */

        const bunnyResponse =
            await fetch(
                bunnyUploadUrl,
                {
                    method: "PUT",

                    headers: {
                        AccessKey:
                            BUNNY_STORAGE_ACCESS_KEY,

                        "Content-Type":
                            file.type ||
                            "application/octet-stream",
                    },

                    body: fileBuffer,
                }
            );

        if (
            !bunnyResponse.ok
        ) {
            const bunnyError =
                await bunnyResponse.text();

            console.error(
                "Bunny upload failed:",
                bunnyResponse.status,
                bunnyError
            );

            return NextResponse.json(
                {
                    error:
                        "Bunny upload failed.",
                },
                {
                    status: 502,
                }
            );
        }

        /* -----------------------------------------
           MEDIA TYPE
        ----------------------------------------- */

        const mediaType =
            getMediaType(
                file.type
            );

        /* -----------------------------------------
           CREATE SUPABASE MEDIA RECORD
        ----------------------------------------- */

        const {
            data: media,
            error: mediaError,
        } = await supabase
            .from("media")
            .insert({
                user_id:
                    user.id,

                pin_id:
                    pinId,

                folder_id:
                    validFolderId,

                name:
                    file.name,

                original_name:
                    file.name,

                source_type:
                    "upload",

                provider:
                    "bunny",

                storage_path:
                    storagePath,

                media_type:
                    mediaType,

                mime_type:
                    file.type ||
                    null,

                file_size:
                    file.size,

                external_url:
                    null,

                external_id:
                    null,

                thumbnail_url:
                    null,

                metadata:
                    {},
            })
            .select(`
        id,
        pin_id,
        folder_id,
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

        /* -----------------------------------------
           DATABASE FAILED AFTER BUNNY SUCCESS
    
           Remove orphaned Bunny file.
        ----------------------------------------- */

        if (
            mediaError ||
            !media
        ) {
            console.error(
                "Could not create media record:",
                mediaError
            );

            await fetch(
                bunnyUploadUrl,
                {
                    method:
                        "DELETE",

                    headers: {
                        AccessKey:
                            BUNNY_STORAGE_ACCESS_KEY,
                    },
                }
            );

            return NextResponse.json(
                {
                    error:
                        "Could not create media record.",
                },
                {
                    status: 500,
                }
            );
        }

        /* -----------------------------------------
           CDN URL
        ----------------------------------------- */

        const cdnUrl =
            `${BUNNY_CDN_URL.replace(
                /\/$/,
                ""
            )}/${storagePath}`;

        /* -----------------------------------------
           SUCCESS
        ----------------------------------------- */

        return NextResponse.json(
            {
                media: {
                    ...media,

                    url:
                        cdnUrl,
                },
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Atlas media upload error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected media upload error.",
            },
            {
                status: 500,
            }
        );
    }
}