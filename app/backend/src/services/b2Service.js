const B2 = require('backblaze-b2');

const applicationKeyId = process.env.B2_KEY_ID?.trim();
const applicationKey = process.env.B2_APPLICATION_KEY?.trim();

function requireB2Config() {
    if (!applicationKeyId || !applicationKey) {
        const msg =
            'B2 upload is not configured. Set B2_KEY_ID and B2_APPLICATION_KEY in .env. ' +
            'Use Application Key ID (from B2 Console → App Keys) and the secret Application Key.';
        throw new Error(msg);
    }
}

const b2 = new B2({
    applicationKeyId: applicationKeyId || 'dummy',
    applicationKey: applicationKey || 'dummy'
});

let isAuthorized = false;

async function authorize() {
    requireB2Config();
    if (!isAuthorized) {
        await b2.authorize();
        isAuthorized = true;
    }
}

async function uploadFile(fileBuffer, fileName, mimeType) {
    const doUpload = async () => {
        await authorize();

        const bucketResponse = await b2.getBucket({
            bucketName: process.env.B2_BUCKET_NAME
        });

        const bucketId = bucketResponse.data.buckets[0].bucketId;

        const uploadUrlResponse = await b2.getUploadUrl({ bucketId });

        const uploadResponse = await b2.uploadFile({
            uploadUrl: uploadUrlResponse.data.uploadUrl,
            uploadAuthToken: uploadUrlResponse.data.authorizationToken,
            fileName,
            data: fileBuffer,
            mime: mimeType
        });

        return uploadResponse.data;
    };

    try {
        return await doUpload();
    } catch (err) {
        const code = err?.response?.data?.code;
        if (code === 'expired_auth_token') {
            // Clear authorization state and retry once with a fresh token
            isAuthorized = false;
            await authorize();
            return doUpload();
        }
        throw err;
    }
}

/**
 * Returns the base URL for public file access. Must be called after authorize() (e.g. after at least one uploadFile call).
 * Uses the downloadUrl from B2 auth response (region-specific, e.g. f001.backblazeb2.com), not a hardcoded endpoint.
 */
function getBaseMediaUrl() {
    if (!isAuthorized || !b2.downloadUrl) {
        throw new Error('B2 not authorized yet. Call uploadFile() first or ensure B2_KEY_ID/B2_APPLICATION_KEY are set.');
    }
    const bucketName = process.env.B2_BUCKET_NAME;
    if (!bucketName) throw new Error('B2_BUCKET_NAME is not set.');
    return `${b2.downloadUrl}/file/${bucketName}`;
}

// Custom CDN takes precedence; otherwise use B2 download URL (requires authorize first, so use getBaseMediaUrl() after upload)
const BASE_MEDIA_URL =
    process.env.CDN_URL || `https://f000.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}`;

module.exports = { uploadFile, BASE_MEDIA_URL, getBaseMediaUrl, requireB2Config };

