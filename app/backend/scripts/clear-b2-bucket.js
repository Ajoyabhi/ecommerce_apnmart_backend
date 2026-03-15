/* Clear ALL files and versions from the configured B2 bucket.
 *
 * Usage (from app/backend):
 *   node scripts/clear-b2-bucket.js
 *
 * Requires B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME in .env
 */

require('dotenv').config();

const B2 = require('backblaze-b2');

const applicationKeyId = process.env.B2_KEY_ID && process.env.B2_KEY_ID.trim();
const applicationKey = process.env.B2_APPLICATION_KEY && process.env.B2_APPLICATION_KEY.trim();
const bucketName = process.env.B2_BUCKET_NAME && process.env.B2_BUCKET_NAME.trim();

function requireB2Config() {
    if (!applicationKeyId || !applicationKey || !bucketName) {
        throw new Error(
            'Missing B2 configuration. Ensure B2_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_NAME are set in .env.'
        );
    }
}

const b2 = new B2({
    applicationKeyId: applicationKeyId || 'dummy',
    applicationKey: applicationKey || 'dummy'
});

async function authorize() {
    requireB2Config();
    await b2.authorize();
}

async function getBucketId() {
    const bucketResponse = await b2.getBucket({ bucketName });
    const buckets = bucketResponse.data && bucketResponse.data.buckets;
    if (!buckets || !buckets.length) {
        throw new Error(`No bucket found with name "${bucketName}".`);
    }
    return buckets[0].bucketId;
}

async function deleteAllFileVersions(bucketId) {
    console.log(`\n🚨 This will delete ALL files and versions from bucket "${bucketName}".`);
    console.log('Starting deletion...');

    let nextFileName = null;
    let nextFileId = null;
    let totalDeleted = 0;

    while (true) {
        const listParams = {
            bucketId,
            maxFileCount: 1000
        };

        if (nextFileName) {
            listParams.startFileName = nextFileName;
        }
        if (nextFileId) {
            listParams.startFileId = nextFileId;
        }

        const listResponse = await b2.listFileVersions(listParams);

        const files = listResponse.data.files || [];
        if (!files.length) {
            break;
        }

        for (const file of files) {
            const fileName = file.fileName;
            const fileId = file.fileId;

            try {
                await b2.deleteFileVersion({
                    fileId,
                    fileName
                });
                totalDeleted += 1;
                console.log(`🗑️  Deleted ${fileName} (${fileId})`);
            } catch (err) {
                console.warn(`⚠️ Failed to delete ${fileName} (${fileId}):`, err.message);
            }
        }

        nextFileName = listResponse.data.nextFileName || null;
        nextFileId = listResponse.data.nextFileId || null;

        if (!nextFileName || !nextFileId) {
            break;
        }
    }

    console.log(`\n✅ Finished. Total file versions deleted: ${totalDeleted}`);
}

async function main() {
    try {
        await authorize();
        const bucketId = await getBucketId();
        await deleteAllFileVersions(bucketId);
    } catch (err) {
        console.error('❌ Failed to clear B2 bucket:', err.message || err);
        if (err.response && err.response.data) {
            console.error('B2 error response:', JSON.stringify(err.response.data, null, 2));
        }
        process.exit(1);
    }
}

main();

