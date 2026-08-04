require('dotenv').config();
const { Worker } = require('bullmq');
const { connection } = require('./queues/connection');
const { QUEUE_NAMES } = require('./queues');
const { processForward } = require('./queues/processors/forward.processor');
const { processInvoice } = require('./queues/processors/invoice.processor');
const { prisma } = require('./config/database');
const logger = require('./utils/logger');

// Job concurrency per queue. Forward jobs are I/O-bound (one downstream POST),
// so a decent concurrency keeps throughput high without heavy CPU. Invoice jobs
// spawn Chromium (CPU + memory heavy), so keep that low.
const FORWARD_CONCURRENCY = parseInt(process.env.FORWARD_CONCURRENCY || '25', 10);
const INVOICE_CONCURRENCY = parseInt(process.env.INVOICE_CONCURRENCY || '2', 10);

const workers = [];

async function start() {
  logger.info('[WORKER] starting payment background workers...');

  const forwardWorker = new Worker(QUEUE_NAMES.FORWARD, processForward, {
    connection,
    concurrency: FORWARD_CONCURRENCY,
  });

  const invoiceWorker = new Worker(QUEUE_NAMES.INVOICE, processInvoice, {
    connection,
    concurrency: INVOICE_CONCURRENCY,
  });

  for (const [name, w] of [['forward', forwardWorker], ['invoice', invoiceWorker]]) {
    w.on('failed', (job, err) => {
      logger.error(`[WORKER:${name}] job ${job?.id} failed (attempt ${job?.attemptsMade}) — ${err.message}`);
    });
    w.on('error', (err) => logger.error(`[WORKER:${name}] worker error — ${err.message}`));
    workers.push(w);
  }

  logger.info(`[WORKER] up — forward x${FORWARD_CONCURRENCY}, invoice x${INVOICE_CONCURRENCY}`);
}

async function shutdown(signal) {
  logger.info(`[WORKER] ${signal} received — draining workers...`);
  try {
    await Promise.all(workers.map(w => w.close()));
    await prisma.$disconnect();
  } catch (err) {
    logger.error(`[WORKER] shutdown error — ${err.message}`);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error(`[WORKER] failed to start — ${err.message}`);
  process.exit(1);
});
