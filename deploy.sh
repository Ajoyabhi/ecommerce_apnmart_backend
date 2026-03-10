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

echo "=== Backend: installing dependencies ==="
cd "${ROOT_DIR}/backend"
npm install

echo "=== Backend: pushing Prisma schema to PostgreSQL (prisma db push) ==="
if command -v npx >/dev/null 2>&1; then
  npx prisma db push
else
  echo "Warning: npx not found, attempting npm run db:push"
  npm run db:push
fi

echo "=== Frontend: installing dependencies ==="
cd "${ROOT_DIR}/Frontend/UrbanKart"
npm install

echo "=== Frontend: building Vite client ==="
npm run build

echo "=== Starting backend with pm2 (name: ecommerce-backend) ==="
cd "${ROOT_DIR}/backend"
pm2 delete ecommerce-backend >/dev/null 2>&1 || true
pm2 start npm --name ecommerce-backend -- start

echo "=== Starting frontend preview with pm2 (name: ecommerce-frontend) ==="
cd "${ROOT_DIR}/Frontend/UrbanKart"
pm2 delete ecommerce-frontend >/dev/null 2>&1 || true
pm2 start npx --name ecommerce-frontend -- vite preview --host 0.0.0.0 --port 5008

echo "=== Saving pm2 process list so it can be restored on reboot ==="
pm2 save

echo "Deployment complete."
echo "Backend should be reachable on the port configured in backend .env (default: 5009)."
echo "Frontend should be reachable on http://<your-vps-ip>:5008 (or via your reverse proxy/domain)."

