# TPE Short Links

Internal URL shortener.

## Features
- Create short link: `{domain}/{CODE}` where `CODE` is case-sensitive `[A-Za-z0-9]+`
- Redirect: `GET /{CODE}` → `302` to `original_url` (active only)
- Never reuse codes (rows are never deleted)
- Tag required; expiry is required (permanent is allowed via `expires_at = NULL`)
- Reserved codes are blocked for both creation and redirect

## Local dev

### 1) Start Postgres

```bash
docker compose up -d
```

### 2) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`.

### 3) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Deploy

### Frontend (Firebase Hosting)

- Copy `.firebaserc.example` → `.firebaserc` and set your Firebase project id.

```bash
cd frontend
npm install
npm run build
cd ..
firebase deploy --only hosting
```

### Backend (GCP Cloud Run)

Build + deploy a container (example):

```bash
gcloud run deploy tpe-short-links-api \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql+psycopg://USER:PASSWORD@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE",ALLOW_HTTP_URLS=false,SHORTLINK_CODE_LENGTH=8,RESERVED_CODES="api,docs,admin,health,metrics",PUBLIC_BASE_URL="https://YOUR_DOMAIN"
```

For Postgres on GCP, use Cloud SQL + the Cloud SQL Unix socket via `/cloudsql/...` (as above), or use a private IP/VPC connector depending on your setup.

## API (contract)
- `POST /api/links`
- `GET  /api/links?query=&tag_id=&status=&limit=&offset=`
- `POST /api/links/{code}/disable`
- `GET  /api/tags`
- `GET  /{code}` (redirect)
