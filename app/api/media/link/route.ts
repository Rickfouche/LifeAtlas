import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   TYPES
========================================= */

type LinkMediaType =
    | "image"
    | "youtube"
    | "youtube_playlist"
    | "website";

type LinkProvider =
    | "youtube"
    | "external";

type DetectedLink = {
    provider: LinkProvider;
    mediaType: LinkMediaType;
    externalId: string | null;
    thumbnailUrl: string | null;
};

/* =========================================
   IMAGE EXTENSIONS
========================================= */

const IMAGE_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".avif",
    ".svg",
    ".bmp",
    ".tif",
    ".tiff",
];

/* =========================================
   URL NORMALIZATION
========================================= */

function normalizeUrl(
    value: string
) {
    let trimmed =
        value.trim();

    if (!trimmed) {
        throw new Error(
            "URL is required."
        );
    }

    /*
      Remove angle brackets that can sometimes
      appear around copied URLs.
    */

    trimmed =
        trimmed.replace(
            /^<|>$/g,
            ""
        );

    const withProtocol =
        /^https?:\/\//i.test(
            trimmed
        )
            ? trimmed
            : `https://${trimmed}`;

    const url =
        new URL(
            withProtocol
        );

    if (
        url.protocol !==
        "http:" &&
        url.protocol !==
        "https:"
    ) {
        throw new Error(
            "Only HTTP and HTTPS links are supported."
        );
    }

    return url;
}

/* =========================================
   YOUTUBE DETECTION
========================================= */

function getYouTubeInfo(
    url: URL
):
    | {
        type:
        | "youtube"
        | "youtube_playlist";
        id: string;
    }
    | null {
    const hostname =
        url.hostname
            .toLowerCase()
            .replace(
                /^www\./,
                ""
            );

    const isYouTube =
        hostname ===
        "youtube.com" ||
        hostname ===
        "m.youtube.com" ||
        hostname ===
        "music.youtube.com" ||
        hostname ===
        "youtu.be";

    if (!isYouTube) {
        return null;
    }

    const playlistId =
        url.searchParams.get(
            "list"
        );

    /*
      Explicit playlist URL.
    */

    if (
        playlistId &&
        url.pathname ===
        "/playlist"
    ) {
        return {
            type:
                "youtube_playlist",
            id:
                playlistId,
        };
    }

    let videoId:
        string | null = null;

    /*
      youtu.be/VIDEO_ID
    */

    if (
        hostname ===
        "youtu.be"
    ) {
        videoId =
            url.pathname
                .split("/")
                .filter(Boolean)[0] ??
            null;
    }

    /*
      youtube.com/watch?v=VIDEO_ID
    */

    else if (
        url.pathname ===
        "/watch"
    ) {
        videoId =
            url.searchParams.get(
                "v"
            );
    }

    /*
      youtube.com/shorts/VIDEO_ID
    */

    else if (
        url.pathname.startsWith(
            "/shorts/"
        )
    ) {
        videoId =
            url.pathname
                .split("/")
                .filter(Boolean)[1] ??
            null;
    }

    /*
      youtube.com/embed/VIDEO_ID
    */

    else if (
        url.pathname.startsWith(
            "/embed/"
        )
    ) {
        videoId =
            url.pathname
                .split("/")
                .filter(Boolean)[1] ??
            null;
    }

    /*
      If the URL contains a valid video,
      treat it as a video even if it also
      happens to contain a playlist parameter.
    */

    if (videoId) {
        return {
            type:
                "youtube",
            id:
                videoId,
        };
    }

    /*
      Playlist fallback.
    */

    if (playlistId) {
        return {
            type:
                "youtube_playlist",
            id:
                playlistId,
        };
    }

    return null;
}

/* =========================================
   IMAGE EXTENSION DETECTION
========================================= */

function hasImageExtension(
    url: URL
) {
    const pathname =
        url.pathname
            .toLowerCase();

    return IMAGE_EXTENSIONS.some(
        (extension) =>
            pathname.endsWith(
                extension
            )
    );
}

/* =========================================
   REMOTE CONTENT TYPE DETECTION

   Some CDNs and image services do not expose
   the image extension in the URL.

   We try HEAD first so Atlas can classify
   the link without downloading the asset.
========================================= */

async function getRemoteContentType(
    url: URL
) {
    try {
        const response =
            await fetch(
                url.toString(),
                {
                    method:
                        "HEAD",

                    redirect:
                        "follow",

                    signal:
                        AbortSignal.timeout(
                            5000
                        ),
                }
            );

        if (
            !response.ok
        ) {
            return null;
        }

        return (
            response.headers.get(
                "content-type"
            ) || null
        );
    } catch {
        /*
          Some sites block HEAD requests.
    
          That should never stop the user
          from saving the link.
        */

        return null;
    }
}

/* =========================================
   LINK DETECTION
========================================= */

async function detectLink(
    url: URL
): Promise<DetectedLink> {
    /* -----------------------------------------
       YOUTUBE
    ----------------------------------------- */

    const youtube =
        getYouTubeInfo(
            url
        );

    if (
        youtube?.type ===
        "youtube"
    ) {
        return {
            provider:
                "youtube",

            mediaType:
                "youtube",

            externalId:
                youtube.id,

            thumbnailUrl:
                `https://i.ytimg.com/vi/${youtube.id}/hqdefault.jpg`,
        };
    }

    if (
        youtube?.type ===
        "youtube_playlist"
    ) {
        return {
            provider:
                "youtube",

            mediaType:
                "youtube_playlist",

            externalId:
                youtube.id,

            thumbnailUrl:
                null,
        };
    }

    /* -----------------------------------------
       IMAGE BY FILE EXTENSION
  
       Example:
       https://cdn.example.com/photo.jpg
    ----------------------------------------- */

    if (
        hasImageExtension(
            url
        )
    ) {
        return {
            provider:
                "external",

            mediaType:
                "image",

            externalId:
                null,

            thumbnailUrl:
                url.toString(),
        };
    }

    /* -----------------------------------------
       IMAGE BY REMOTE CONTENT TYPE
  
       Example:
       https://cdn.example.com/assets/938284
    ----------------------------------------- */

    const contentType =
        await getRemoteContentType(
            url
        );

    if (
        contentType
            ?.toLowerCase()
            .startsWith(
                "image/"
            )
    ) {
        return {
            provider:
                "external",

            mediaType:
                "image",

            externalId:
                null,

            thumbnailUrl:
                url.toString(),
        };
    }

    /* -----------------------------------------
       WEBSITE FALLBACK
    ----------------------------------------- */

    return {
        provider:
            "external",

        mediaType:
            "website",

        externalId:
            null,

        thumbnailUrl:
            null,
    };
}

/* =========================================
   DEFAULT DISPLAY NAME
========================================= */

function getDefaultName(
    url: URL,
    detected: DetectedLink
) {
    if (
        detected.mediaType ===
        "youtube"
    ) {
        return "YouTube Video";
    }

    if (
        detected.mediaType ===
        "youtube_playlist"
    ) {
        return "YouTube Playlist";
    }

    if (
        detected.mediaType ===
        "image"
    ) {
        const filename =
            url.pathname
                .split("/")
                .filter(Boolean)
                .pop();

        if (filename) {
            try {
                return decodeURIComponent(
                    filename
                );
            } catch {
                return filename;
            }
        }

        return "Image";
    }

    return url.hostname
        .replace(
            /^www\./,
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
           AUTH
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
           REQUEST BODY
        ----------------------------------------- */

        const body =
            await request.json();

        const pinId =
            typeof body.pinId ===
                "string"
                ? body.pinId.trim()
                : "";

        const rawUrl =
            typeof body.url ===
                "string"
                ? body.url.trim()
                : "";

        const requestedName =
            typeof body.name ===
                "string"
                ? body.name.trim()
                : "";

        const folderId =
            typeof body.folderId ===
                "string" &&
                body.folderId.trim()
                ? body.folderId.trim()
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

        if (!rawUrl) {
            return NextResponse.json(
                {
                    error:
                        "URL is required.",
                },
                {
                    status: 400,
                }
            );
        }

        /* -----------------------------------------
           NORMALIZE URL
        ----------------------------------------- */

        let url: URL;

        try {
            url =
                normalizeUrl(
                    rawUrl
                );
        } catch {
            return NextResponse.json(
                {
                    error:
                        "Enter a valid website URL.",
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
           VERIFY OPTIONAL FOLDER
        ----------------------------------------- */

        let validFolderId:
            string | null = null;

        if (folderId) {
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
           DETECT CONTENT TYPE
        ----------------------------------------- */

        const detected =
            await detectLink(
                url
            );

        /* -----------------------------------------
           DISPLAY NAME
        ----------------------------------------- */

        const name =
            requestedName ||
            getDefaultName(
                url,
                detected
            );

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

        /* -----------------------------------------
           CREATE SUPABASE MEDIA RECORD
    
           External content remains external.
           Nothing is uploaded to Bunny.
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

                name,

                original_name:
                    null,

                source_type:
                    "link",

                provider:
                    detected.provider,

                storage_path:
                    null,

                media_type:
                    detected.mediaType,

                mime_type:
                    null,

                file_size:
                    null,

                external_url:
                    url.toString(),

                external_id:
                    detected.externalId,

                thumbnail_url:
                    detected.thumbnailUrl,

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
           DATABASE ERROR
        ----------------------------------------- */

        if (
            mediaError ||
            !media
        ) {
            console.error(
                "Could not create linked media record:",
                mediaError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not add link to Atlas.",
                },
                {
                    status: 500,
                }
            );
        }

        /* -----------------------------------------
           SUCCESS
        ----------------------------------------- */

        return NextResponse.json(
            {
                media: {
                    ...media,

                    url:
                        media.external_url,
                },
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Atlas media link error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected link creation error.",
            },
            {
                status: 500,
            }
        );
    }
}