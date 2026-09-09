import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getMediaCdnUrl } from "@/lib/bunnyStorage";

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
   POST
========================================= */

export async function POST(
    request: Request
) {
    try {
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
           READ JSON
        ----------------------------------------- */

        const body =
            await request.json();

        const {
            pinId,
            folderId,
            storagePath,
            filename,
            mimeType,
            fileSize,
        } = body ?? {};

        if (
            typeof pinId !== "string" ||
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

        if (
            typeof storagePath !== "string" ||
            !storagePath
        ) {
            return NextResponse.json(
                {
                    error:
                        "Storage path is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            typeof filename !== "string" ||
            !filename
        ) {
            return NextResponse.json(
                {
                    error:
                        "Filename is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            typeof fileSize !== "number" ||
            !Number.isFinite(fileSize) ||
            fileSize <= 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "Valid file size is required.",
                },
                {
                    status: 400,
                }
            );
        }

        /* -----------------------------------------
           VERIFY STORAGE PATH OWNERSHIP

           Prepare creates:
           USER_UUID / PIN_UUID / FILE_UUID.ext

           Never let the browser register a path
           outside its authenticated user + Pin.
        ----------------------------------------- */

        const expectedPrefix =
            `${user.id}/${pinId}/`;

        if (
            !storagePath.startsWith(
                expectedPrefix
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid media storage path.",
                },
                {
                    status: 403,
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
            typeof folderId === "string" &&
            folderId
        ) {
            const {
                data: folder,
                error: folderError,
            } = await supabase
                .from("media_folders")
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
           NORMALIZE MIME / MEDIA TYPE
        ----------------------------------------- */

        const normalizedMimeType =
            typeof mimeType === "string" &&
            mimeType
                ? mimeType
                : "application/octet-stream";

        const mediaType =
            getMediaType(
                normalizedMimeType
            );

        /* -----------------------------------------
           CREATE MEDIA RECORD

           Same record shape as V1.
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
                    filename,

                original_name:
                    filename,

                source_type:
                    "upload",

                provider:
                    "bunny",

                storage_path:
                    storagePath,

                media_type:
                    mediaType,

                mime_type:
                    normalizedMimeType,

                file_size:
                    fileSize,

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

        if (
            mediaError ||
            !media
        ) {
            console.error(
                "Could not create media record:",
                mediaError
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
           PUBLIC CDN URL
        ----------------------------------------- */

        const url =
            getMediaCdnUrl(
                storagePath
            );

        /* -----------------------------------------
           SUCCESS
        ----------------------------------------- */

        return NextResponse.json(
            {
                media: {
                    ...media,
                    url,
                },
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Atlas media upload completion error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Could not complete media upload.",
            },
            {
                status: 500,
            }
        );
    }
}