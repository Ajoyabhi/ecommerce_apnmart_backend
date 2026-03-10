## Lifestyle E‑commerce – VPS Deployment Guide

This document explains **how to deploy the full stack (backend + frontend)** of this e‑commerce project on a **single VPS**. It covers:

- **What runs where** (backend, frontend, databases)
- **Which environment variables you must set**
- **How to prepare your VPS (Ubuntu‑style)**
- **How to start everything with one command:** `./deploy.sh`

The guide assumes:

- A fresh VPS (e.g. Ubuntu 22.04/24.04) with SSH access
- Basic Linux familiarity (SSH, editing files, running commands)
- You manage DNS and HTTPS/SSL yourself (e.g. via Nginx + Certbot)

---

## 1. High‑level architecture

- **Backend (`app/backend/`)**
  - Node.js + Express REST API
  - **PostgreSQL** via Prisma (`DATABASE_URL`)
  - **MongoDB** for content / banners (`MONGODB_URI`)
  - **Redis** for caching / cart (`REDIS_URL`)
  - Integrations:
    - **Stripe** for payments (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
    - **Cloudinary / Backblaze B2** (media & product images)
    - **SMTP / Brevo** for transactional email and OTP flows
  - Default port: **`5009`** (configurable via backend `.env`)

- **Frontend (`app/Frontend/UrbanKart/`)**
  - React + Vite SPA, consumes backend at `/api/v1`
  - Talks to backend through **`VITE_API_URL`** (e.g. `http://your-vps-ip:5009`)
  - Media base URL configured via **`VITE_MEDIA_BASE_URL`** (e.g. B2, Cloudinary)
  - Dev server port (Vite): **`5008`**; in production we serve the built bundle via `vite preview` on **port `5008`**.

- **Single deploy script (`deploy.sh` at repo root)**
  - Installs Node dependencies for backend and frontend
  - Runs **Prisma `db push`** to sync PostgreSQL schema
  - Builds the frontend (Vite)
  - Starts **backend and frontend** using **pm2**
  - After setup, you only need:  
    ```bash
    chmod +x ./deploy.sh
    ./deploy.sh
    ```

---

## 2. Required services & ports

On your VPS you will run:

- **PostgreSQL** (default: `localhost:5432`)
- **MongoDB** (default: `localhost:27017`)
- **Redis** (default: `localhost:6379`)
- **Node.js backend** (Express) – port from backend `.env` (default: `5009`)
- **Vite frontend preview** – `http://0.0.0.0:5008`

In production you typically:

- Expose **port 5008** (frontend) and optionally **5009** (API) via a reverse proxy (e.g. Nginx)
- Keep PostgreSQL, MongoDB, Redis bound to `localhost` only (firewall closed to the internet)

---

## 3. Prepare your VPS (system-level)

### 3.1. System packages

On an Ubuntu‑like VPS, as a sudo user:

```bash
sudo apt update
sudo apt install -y git curl build-essential
```

### 3.2. Install Node.js (LTS, e.g. 20.x)

Using `nvm` (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc  # or ~/.zshrc
nvm install 20
nvm use 20
```

Verify:

```bash
node -v
npm -v
```

### 3.3. Install PostgreSQL

On Ubuntu:

```bash
sudo apt install -y postgresql postgresql-contrib
```

Create a database and user for this project (adjust names/passwords):

```bash
sudo -u postgres psql
```

In the `psql` shell:

```sql
CREATE USER ecommerce_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE ecommerce_prod OWNER ecommerce_user;
GRANT ALL PRIVILEGES ON DATABASE ecommerce_prod TO ecommerce_user;
\q
```

Your **PostgreSQL connection URL** for the backend will look like:

```text
postgresql://ecommerce_user:STRONG_PASSWORD_HERE@localhost:5432/ecommerce_prod?schema=public
```

### 3.4. Install MongoDB

Install MongoDB via your distribution or from official MongoDB docs (recommended to follow the latest instructions for your OS/version).  
Once installed, ensure it is running and listening on `localhost:27017`.  

Example Mongo URL:

```text
mongodb://localhost:27017/lifestyle_ecommerce
```

### 3.5. Install Redis

On Ubuntu:

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Example Redis URL:

```text
redis://localhost:6379
```

---

## 4. Project checkout on the VPS

SSH into your VPS, then:

```bash
cd ~
git clone <your-repo-url> ecommerce
cd ecommerce
```

You should now have:

- `app/backend/`
- `app/Frontend/UrbanKart/`
- `deploy.sh`

---

## 5. Backend configuration (`app/backend/.env`)

The backend uses **Prisma with PostgreSQL**, plus MongoDB, Redis, Stripe, Cloudinary, email, and Backblaze B2.  

### 5.1. Create the `.env` file

On your VPS:

```bash
cd ~/ecommerce/app/backend
cp .env.example .env  # or create manually
```

Then open `.env` and configure at minimum:

- **Server**
  - `PORT=5009`  
    Port the backend API will listen on. You can change it, but keep it in sync with:
    - Frontend `VITE_API_URL`
    - Any reverse proxy config

- **PostgreSQL (Prisma)**
  - `DATABASE_URL="postgresql://ecommerce_user:STRONG_PASSWORD_HERE@localhost:5432/ecommerce_prod?schema=public"`

- **MongoDB**
  - `MONGODB_URI="mongodb://localhost:27017/lifestyle_ecommerce"`

- **Redis**
  - `REDIS_URL="redis://localhost:6379"`

- **JWT / Auth**
  - Use strong, unique secrets:
  - `JWT_ACCESS_SECRET="a_long_random_string_here"`
  - `JWT_REFRESH_SECRET="another_long_random_string_here"`
  - `JWT_ACCESS_EXPIRATION="15m"`
  - `JWT_REFRESH_EXPIRATION="7d"`

- **Stripe (payments)**
  - `STRIPE_SECRET_KEY="sk_live_or_test_key_here"`
  - `STRIPE_WEBHOOK_SECRET="whsec_..."`  
    (from your Stripe dashboard; required if you enable webhooks)

- **Storage & media**
  - Either use **Cloudinary**:
    - `CLOUDINARY_CLOUD_NAME=your_cloud_name`
    - `CLOUDINARY_API_KEY=your_api_key`
    - `CLOUDINARY_API_SECRET=your_api_secret`
  - Or **Backblaze B2** (as in example seed scripts):
    - `B2_KEY_ID=...`
    - `B2_APPLICATION_KEY=...`
    - `B2_BUCKET_NAME=Product2026`

- **Email / Brevo**
  - If using Brevo API:
    - `BREVO_API_KEY=your_brevo_api_key`
    - `EMAIL_FROM=no-reply@yourdomain.com`
    - `EMAIL_FROM_NAME=Your Store`
  - Or SMTP:
    - `SMTP_HOST=smtp.yourprovider.com`
    - `SMTP_PORT=587`
    - `SMTP_USER=your_smtp_user`
    - `SMTP_PASS=your_smtp_password`
    - `FROM_EMAIL=noreply@yourdomain.com`

- **CORS and frontend URL**
  - `CORS_ORIGIN=https://your-frontend-domain.com`
    - Comma‑separated list of allowed frontend origins
  - `FRONTEND_URL=https://your-frontend-domain.com`

- **Google OAuth (optional)**
  - `GOOGLE_CLIENT_ID=...`
  - `GOOGLE_CLIENT_SECRET=...`  
  - Add the redirect URI based on your backend base URL, e.g.:  
    `https://your-api-domain.com/api/v1/auth/google/callback`

> **Important:** Never commit real secrets back to the repo. Keep `.env` only on the VPS or in your secret manager.

---

## 6. Frontend configuration (`app/Frontend/UrbanKart/.env`)

The frontend is a Vite app that talks to the backend via `VITE_API_URL`.

### 6.1. Create the `.env` file

On your VPS:

```bash
cd ~/ecommerce/app/Frontend/UrbanKart
cp .env.example .env  # if present, or create manually
```

Then set at least:

- **Backend base URL**

  ```env
  VITE_API_URL=http://your-vps-ip-or-domain:5009
  ```

  Examples:

  - No reverse proxy, direct IP: `VITE_API_URL=http://203.0.113.10:5009`
  - With API domain: `VITE_API_URL=https://api.yourstore.com`

- **Media base URL**

  If you use Backblaze B2 as in your seed data:

  ```env
  VITE_MEDIA_BASE_URL=https://f005.backblazeb2.com/file/Product2026
  ```

  Or for Cloudinary / other CDN, set it to your media base URL:

  ```env
  VITE_MEDIA_BASE_URL=https://res.cloudinary.com/<cloud_name>/image/upload
  ```

> The frontend reads `VITE_API_URL` at build time, so **update `.env` before running `deploy.sh`**.

---

## 7. One‑command deployment with `deploy.sh`

Once:

- Databases (PostgreSQL, MongoDB, Redis) are installed and running
- Backend `.env` is configured
- Frontend `.env` is configured
- Node.js 20+ is installed

You can start the full stack using the provided script.

### 7.1. Make the script executable

From the project root (`~/ecommerce`):

```bash
chmod +x ./deploy.sh
```

### 7.2. Run the deployment

```bash
./deploy.sh
```

What `deploy.sh` does:

1. Verifies `node` and `npm` are installed.
2. Installs **pm2** globally if missing.
3. **Backend**
   - `cd app/backend`
   - `npm install`
   - `prisma db push` (via `npx prisma db push`) to sync the PostgreSQL schema with `DATABASE_URL`.
4. **Frontend**
   - `cd app/Frontend/UrbanKart`
   - `npm install`
   - `npm run build` (Vite production build)
5. **Process manager (pm2)**
   - Starts backend: `pm2 start npm --name ecommerce-backend -- start`
     - Uses backend script: `"start": "node src/server.js"`
   - Starts frontend preview server:  
     `pm2 start npx --name ecommerce-frontend -- vite preview --host 0.0.0.0 --port 5008`
   - Saves the current pm2 process list with `pm2 save`

After it finishes:

- Backend API: `http://<your-vps-ip>:<PORT_FROM_BACKEND_ENV>` (default `5009`)
- Frontend app: `http://<your-vps-ip>:5008`

You can check pm2 status with:

```bash
pm2 ls
pm2 logs ecommerce-backend
pm2 logs ecommerce-frontend
```

---

## 8. Making pm2 restart on reboot (recommended)

On the VPS, once pm2 is set up:

```bash
pm2 startup systemd
```

Follow the printed instruction (it will give you a `sudo` command). Then:

```bash
pm2 save
```

Now your `ecommerce-backend` and `ecommerce-frontend` processes will restart automatically when the VPS reboots.

---

## 9. Reverse proxy with Nginx and SSL (HTTPS)

To serve the app on standard ports **80/443** with HTTPS, you typically:

- Run the apps only on internal ports:
  - Frontend: `http://127.0.0.1:5008`
  - API: `http://127.0.0.1:5009`
- Use **Nginx** as a reverse proxy on the public ports:
  - `store.yourdomain.com` → frontend
  - `api.yourdomain.com` → backend
- Use **Certbot (Let’s Encrypt)** to obtain and auto‑renew SSL certificates.

### 9.1. Basic Nginx reverse proxy (HTTP only, before SSL)

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a config file, e.g. `/etc/nginx/sites-available/lifestyle-ecommerce.conf`:

```nginx
server {
    listen 80;
    server_name store.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5008;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5009;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/lifestyle-ecommerce.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

At this point, HTTP (port 80) should proxy correctly.

### 9.2. Issue and enable SSL with Certbot (Let’s Encrypt)

1. **Install Certbot and the Nginx plugin:**

   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. **Ensure DNS is configured** so that:
   - `store.yourdomain.com` points to your VPS public IP
   - `api.yourdomain.com` points to your VPS public IP

3. **Run Certbot to obtain certificates and auto‑configure Nginx:**

   ```bash
   sudo certbot --nginx -d store.yourdomain.com -d api.yourdomain.com
   ```

   - Choose the option to **redirect HTTP to HTTPS** when prompted.
   - Certbot will:
     - Create/modify your Nginx server blocks
     - Add `listen 443 ssl;`, certificate paths, and secure redirects

4. **Verify renewal:**

   Certbot installs a cron job / systemd timer for automatic renewal. You can test it with:

   ```bash
   sudo certbot renew --dry-run
   ```

After this, your setup should be:

- `https://store.yourdomain.com` → Nginx → `http://127.0.0.1:5008` (frontend)
- `https://api.yourdomain.com` → Nginx → `http://127.0.0.1:5009` (backend)

---

## 10. Summary

- Configure **databases** (Postgres, Mongo, Redis) and create the **PostgreSQL `DATABASE_URL`**.
- Fill out **`backend/.env`** with DB URLs, JWT secrets, email/Stripe/media credentials, and CORS/FRONTEND URLs.
- Set **`app/Frontend/UrbanKart/.env`** with `VITE_API_URL` (pointing to backend, port `5009` by default) and `VITE_MEDIA_BASE_URL`.
- On your VPS, from the project root, run:

```bash
chmod +x ./deploy.sh
./deploy.sh
```

This will build and start both backend and frontend via pm2 on your VPS.

