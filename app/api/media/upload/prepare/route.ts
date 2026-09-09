import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createMediaUploadUrl } from "@/lib/bunnyStorage";

/* =========================================
   CONFIG
========================================= */

const STANDARD_MAX_FILE_SIZE =
    25 * 1024 * 1024;

/* =========================================
   FILE EXTENSION
========================================= */

function getExtension(
    filename: string
) {
    const lastDot =
        filename.lastIndexOf(".");

    if (lastDot === -1) {
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
           READ SMALL JSON REQUEST

           No file bytes pass through this route.
        ----------------------------------------- */

        const body =
            await request.json();

        const {
            pinId,
            folderId,
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
           TEMP STANDARD ACCOUNT LIMIT

           We'll add owner / plan entitlements later.
           For this transport test, keep the existing
           Atlas 25 MB application policy.

           This is now an Atlas policy rather than a
           Vercel request-body limitation.
        ----------------------------------------- */

        if (
            fileSize >
            STANDARD_MAX_FILE_SIZE
        ) {
            return NextResponse.json(
                {
                    error:
                        "Files must currently be 25 MB or smaller.",
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
           CREATE STORAGE PATH

           Same organization as V1:
           USER_UUID / PIN_UUID / FILE_UUID.ext
        ----------------------------------------- */

        const extension =
            getExtension(
                filename
            );

        const storedFilename =
            `${crypto.randomUUID()}${extension}`;

        const storagePath =
            `${user.id}/${pinId}/${storedFilename}`;

        /* -----------------------------------------
           CREATE SHORT-LIVED BUNNY S3 URL
        ----------------------------------------- */

        const uploadUrl =
            await createMediaUploadUrl({
                storagePath,

                contentType:
                    typeof mimeType === "string" &&
                    mimeType
                        ? mimeType
                        : "application/octet-stream",
            });

        /* -----------------------------------------
           SUCCESS

           Notice:
           no media database record exists yet.
           We only create that after Bunny confirms
           the browser upload succeeded.
        ----------------------------------------- */

        return NextResponse.json(
            {
                uploadUrl,
                storagePath,
                folderId:
                    validFolderId,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas media upload prepare error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Could not prepare media upload.",
            },
            {
                status: 500,
            }
        );
    }
}