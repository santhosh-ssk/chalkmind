# Environment Variables

## Local Development

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Google Gemini API key | `AIza...` |

### Optional (features disabled if unset)

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT` | API rate limit per client | `1/30seconds` |
| `RECAPTCHA_ENABLED` | Enable reCAPTCHA validation | `false` |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v2 secret key (backend) | — |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v2 site key (frontend) | — |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID | `G-XXXXXXXXXX` |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key (backend tracing) | `sk-lf-...` |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key (backend tracing) | `pk-lf-...` |
| `LANGFUSE_BASE_URL` | Langfuse host URL | `https://cloud.langfuse.com` |
| `QUIZ_TIMER_SECONDS` | Seconds per quiz question (backend voice agent) | `6` |
| `VITE_QUIZ_TIMER_SECONDS` | Seconds per quiz question (frontend timer) | `6` |

> `VITE_` prefixed variables are baked into the frontend at build time by Vite. All others are backend runtime variables.

---

## Production (GCP Cloud Run)

### GCP Secret Manager

Sensitive values stored as secrets and mounted at runtime by Cloud Run:

| Secret Name | Description |
|-------------|-------------|
| `GOOGLE_API_KEY` | Google Gemini API key |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v2 secret key |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |

Create them:

```bash
echo -n "your-value" | gcloud secrets create SECRET_NAME --data-file=-
```

Grant Cloud Run access:

```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:YOUR_SA@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Cloud Run Environment Variables

Non-secret config passed from GitHub Actions Variables to Cloud Run at deploy time:

| Variable | Value |
|----------|-------|
| `RECAPTCHA_ENABLED` | `true` |
| `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` |
| `RATE_LIMIT` | `1/30seconds` |

> These are set as GitHub Variables (see below) and referenced in `deploy.yml`.

---

## GitHub Actions

### Secrets (repo Settings > Secrets and variables > Actions > Secrets)

Used for GCP authentication during deployment:

| Secret | Description |
|--------|-------------|
| `WIF_PROVIDER` | Workload Identity Federation provider |
| `WIF_SERVICE_ACCOUNT` | GCP service account email |
| `GCP_PROJECT_ID` | GCP project ID |

### Variables (repo Settings > Secrets and variables > Actions > Variables)

Public values passed as Docker build args for the frontend build:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_GA_MEASUREMENT_ID` | GA4 measurement ID (frontend build arg) | `G-XXXXXXXXXX` |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA site key (frontend build arg) | `6Lc...` |
| `RECAPTCHA_ENABLED` | Enable reCAPTCHA on Cloud Run | `true` |
| `LANGFUSE_BASE_URL` | Langfuse host URL for Cloud Run | `https://cloud.langfuse.com` |
| `RATE_LIMIT` | API rate limit for Cloud Run | `1/30seconds` |
| `VITE_QUIZ_TIMER_SECONDS` | Quiz timer (frontend build arg) | `6` |
| `QUIZ_TIMER_SECONDS` | Quiz timer (Cloud Run env var) | `6` |

> `VITE_*` variables are baked into the frontend at Docker build time. The rest are passed as Cloud Run env vars at deploy time. None are secrets — use GitHub Variables (not Secrets) so they appear in build logs for debugging.
