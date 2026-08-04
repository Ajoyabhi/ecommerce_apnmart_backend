// BullMQ connection options. BullMQ (v6) manages its own ioredis client
// internally — we just hand it the connection options. `maxRetriesPerRequest`
// MUST be null for BullMQ workers (blocking commands), and is harmless for
// queues, so we set it here once and share it everywhere.
const connection = {
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,
};

module.exports = { connection };
