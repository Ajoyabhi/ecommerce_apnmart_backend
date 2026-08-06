#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Lifestyle E‑commerce deploy ==="
echo "Root directory: ${ROOT_DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Install Node.js 20+ and run this script again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not available. Install npm and run this script again."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found, installing globally with npm..."
  npm install -g pm2
fi

# echo "=== Backend: installing dependencies ==="
# cd "${ROOT_DIR}/app/backend"
# npm install

echo "=== Backend: pushing Prisma schema to PostgreSQL (prisma db push) ==="
if command -v npx >/dev/null 2>&1; then
  npx prisma db push
else
  echo "Warning: npx not found, attempting npm run db:push"
  npm run db:push
fi

# echo "=== Frontend: installing dependencies ==="
# cd "${ROOT_DIR}/app/Frontend/UrbanKart"
# npm install

echo "=== Frontend: building Vite client ==="
npm run build

echo "=== Starting backend with pm2 (name: ecommerce-backend) ==="
cd "${ROOT_DIR}/app/backend"
pm2 delete ecommerce-backend >/dev/null 2>&1 || true
# Cluster mode. The payin path is I/O-bound (mostly awaiting the gateway), so a
# few workers hold plenty of concurrent in-flight requests. This box has 4 vCPU
# shared with Postgres + MongoDB + Redis, so we deliberately DON'T take all 4 —
# 3 workers for Node, ~1 core left for the datastores. Bump to `max` only if you
# move the databases off this box. Point pm2 at server.js (not `npm`) so -i works.
pm2 start src/server.js -i 3 --name ecommerce-backend

echo "=== Starting background worker with pm2 (name: ecommerce-worker) ==="
# Dedicated process for BullMQ jobs (downstream forward + invoice generation),
# kept separate from the web workers so background load never blocks payin traffic.
# Single fork instance; scale with FORWARD_CONCURRENCY / INVOICE_CONCURRENCY env vars.
pm2 delete ecommerce-worker >/dev/null 2>&1 || true
pm2 start src/worker.js --name ecommerce-worker

echo "=== Starting frontend preview with pm2 (name: ecommerce-frontend) ==="
cd "${ROOT_DIR}/app/Frontend/UrbanKart"
pm2 delete ecommerce-frontend >/dev/null 2>&1 || true
pm2 start npx --name ecommerce-frontend -- vite preview --host 0.0.0.0 --port 5008

echo "=== Saving pm2 process list so it can be restored on reboot ==="
pm2 save

echo "Deployment complete."
echo "Backend should be reachable on the port configured in backend .env (default: 5009)."
echo "Frontend should be reachable on http://<your-vps-ip>:5008 (or via your reverse proxy/domain)."

pm2 logs ecommerce-backend --lines 30 --nostream