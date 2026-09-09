type DirectMediaUploadInput = {
    file: File;
    pinId: string;
    folderId?: string | null;
};

type DirectMediaUploadResult = {
    media: {
        id: string;
        pin_id: string;
        folder_id: string | null;
        moment_id: string | null;
        name: string;
        original_name: string | null;
        source_type: "upload";
        provider: "bunny";
        storage_path: string | null;
        media_type:
            | "image"
            | "audio"
            | "video"
            | "pdf"
            | "file";
        mime_type: string | null;
        file_size: number | string | null;
        external_url: string | null;
        external_id: string | null;
        thumbnail_url: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
        url: string;
    };
};

async function readResponseJson(
    response: Response
) {
    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            error:
                text,
        };
    }
}

export async function uploadMediaDirect({
    file,
    pinId,
    folderId = null,
}: DirectMediaUploadInput): Promise<DirectMediaUploadResult> {
    /* =========================================
       1. PREPARE
    ========================================= */

    const prepareResponse =
        await fetch(
            "/api/media/upload/prepare",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                body:
                    JSON.stringify({
                        pinId,

                        folderId,

                        filename:
                            file.name,

                        mimeType:
                            file.type ||
                            "application/octet-stream",

                        fileSize:
                            file.size,
                    }),
            }
        );

    const prepareResult =
        await readResponseJson(
            prepareResponse
        );

    if (
        !prepareResponse.ok
    ) {
        throw new Error(
            prepareResult.error ??
            "Could not prepare upload."
        );
    }

    const uploadUrl =
        prepareResult.uploadUrl;

    const storagePath =
        prepareResult.storagePath;

    if (
        typeof uploadUrl !==
            "string" ||
        typeof storagePath !==
            "string"
    ) {
        throw new Error(
            "Atlas did not return a valid upload target."
        );
    }

    /* =========================================
       2. DIRECT BROWSER -> BUNNY
    ========================================= */

    const bunnyResponse =
        await fetch(
            uploadUrl,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        file.type ||
                        "application/octet-stream",
                },

                body:
                    file,
            }
        );

    if (
        !bunnyResponse.ok
    ) {
        const bunnyMessage =
            await bunnyResponse
                .text()
                .catch(
                    () => ""
                );

        console.error(
            "Direct Bunny upload failed:",
            bunnyResponse.status,
            bunnyMessage
        );

        throw new Error(
            `Storage upload failed (${bunnyResponse.status}).`
        );
    }

    /* =========================================
       3. COMPLETE
    ========================================= */

    const completeResponse =
        await fetch(
            "/api/media/upload/complete",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                body:
                    JSON.stringify({
                        pinId,

                        folderId,

                        storagePath,

                        filename:
                            file.name,

                        mimeType:
                            file.type ||
                            "application/octet-stream",

                        fileSize:
                            file.size,
                    }),
            }
        );

    const completeResult =
        await readResponseJson(
            completeResponse
        );

    if (
        !completeResponse.ok
    ) {
        throw new Error(
            completeResult.error ??
            "Upload reached storage, but Atlas could not register it."
        );
    }

    return completeResult as
        DirectMediaUploadResult;
}