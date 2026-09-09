import {
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

import {
    getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

const bucket =
    process.env.BUNNY_S3_BUCKET;

const accessKeyId =
    process.env.BUNNY_S3_ACCESS_KEY_ID;

const secretAccessKey =
    process.env.BUNNY_S3_SECRET_ACCESS_KEY;

const endpoint =
    process.env.BUNNY_S3_ENDPOINT;

const region =
    process.env.BUNNY_S3_REGION ?? "de";

const cdnUrl =
    process.env.BUNNY_S3_CDN_URL;

function requireValue(
    value: string | undefined,
    name: string
) {
    if (!value) {
        throw new Error(
            `Missing ${name}.`
        );
    }

    return value;
}

const s3Client =
    new S3Client({
        region,

        endpoint:
            requireValue(
                endpoint,
                "BUNNY_S3_ENDPOINT"
            ),

        credentials: {
            accessKeyId:
                requireValue(
                    accessKeyId,
                    "BUNNY_S3_ACCESS_KEY_ID"
                ),

            secretAccessKey:
                requireValue(
                    secretAccessKey,
                    "BUNNY_S3_SECRET_ACCESS_KEY"
                ),
        },

        forcePathStyle: true,
    });

export async function createMediaUploadUrl({
    storagePath,
    contentType,
}: {
    storagePath: string;
    contentType: string;
}) {
    const command =
        new PutObjectCommand({
            Bucket:
                requireValue(
                    bucket,
                    "BUNNY_S3_BUCKET"
                ),

            Key:
                storagePath,

            ContentType:
                contentType ||
                "application/octet-stream",
        });

    const uploadUrl =
        await getSignedUrl(
            s3Client,
            command,
            {
                expiresIn: 5 * 60,
            }
        );

    return uploadUrl;
}

export function getMediaCdnUrl(
    storagePath: string
) {
    return `${requireValue(
        cdnUrl,
        "BUNNY_S3_CDN_URL"
    ).replace(/\/$/, "")}/${storagePath}`;
}