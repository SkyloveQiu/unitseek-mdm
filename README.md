<p align="center">
  <img src="frontend/public/unitseek-mdm-logo-v2.png" width="120" alt="Unitseek MDM logo" />
</p>

<h1 align="center">Unitseek MDM</h1>

<p align="center">
  A lightweight, self-hosted Android Enterprise device manager for teams that want control without enterprise-suite overhead.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-0b6bcb?style=flat-square" alt="AGPL-3.0 license" /></a>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square" alt="FastAPI" />
  <img src="https://img.shields.io/badge/frontend-React-61dafb?style=flat-square" alt="React" />
  <img src="https://img.shields.io/badge/Android-Enterprise-3ddc84?style=flat-square" alt="Android Enterprise" />
</p>

> **Status:** active MVP. Unitseek MDM is built for real Android Enterprise onboarding, small fleets, and transparent self-hosted deployments. Please use a non-production tenant and test device while evaluating it.

## Why Unitseek MDM?

Android Enterprise should not require a heavy, opaque control plane. Unitseek MDM gives operators a focused web console for managing company-owned Android devices through the [Google Android Management API](https://developers.google.com/android/management).

- Enroll **fully managed** and **dedicated** devices with QR enrollment tokens
- Create reusable device policies, including kiosk controls and password requirements
- Organize devices into groups and inspect inventory, compliance, and installed applications
- Manage Google Play applications and policy assignments
- Send audited device commands: lock, reboot, reset password, and wipe
- Keep deployment simple: FastAPI, React, Caddy, and a standard SQL database
- Run natively on a small VM; Docker is optional for local development only

## Architecture

```text
Android devices
      │ Android Device Policy
      ▼
Google Android Management API
      │
      ▼
Unitseek MDM API ──────── SQL database
      │                         ▲
      ▼                         │
React administration console ───┘
```

Google Android Management API remains the source of truth for managed Android device state. Unitseek MDM provides the operator experience, tenancy boundaries, auditing, and deployment control around it.

## What you need

- A Google Cloud project with **Android Management API** enabled
- A service account granted the **Android Management User** role
- A Google Android Enterprise binding and initial device quota
- Python 3.11+, Node.js 20+, and MySQL 8+ or a supported PostgreSQL development database
- A public HTTPS domain for Android Enterprise callbacks in production

Never commit service-account JSON, database passwords, session secrets, or production `.env` files. The supplied templates use placeholders only.

## Quick start

### 1. Configure the backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database URL, secret key, and Google settings.
```

For local development, keep `AMAPI_MODE=mock`. Switch to `AMAPI_MODE=real` only after your Google project, service-account credential path, and Android Management API quota are ready.

### 2. Start the API

```bash
cd backend
python -m venv .venv
. .venv/bin/activate              # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 3. Start the web console

```bash
cd frontend
npm ci
npm run dev
```

Open the address printed by Vite, register the first administrator, and then complete the Android Enterprise connection under **Settings → Tenant**.

## Production deployment

The production path in this repository is deliberately small and native:

- `easy-mdm` runs as a restricted systemd service on `127.0.0.1:8003`
- Caddy serves the compiled React application, proxies `/api` and `/health`, and terminates HTTPS
- MySQL is reachable over verified TLS; database state does not live on the VM

Review the templates in [`deploy/`](deploy/) before deploying. A typical Ubuntu deployment is:

```bash
cd frontend && npm ci && npm run build && cd ..
sudo install -d -m 0750 /etc/easy-mdm
sudo cp deploy/easy-mdm.env.example /etc/easy-mdm/easy-mdm.env
sudo cp deploy/caddy.env.example /etc/easy-mdm/caddy.env
# Set DNS, database, CORS, session-secret, and AMAPI values in /etc/easy-mdm/.
sudo bash deploy/install-native-ubuntu.sh
sudo systemctl status easy-mdm caddy
```

Use `AMAPI_MODE=mock` until the Google configuration is complete. Never publish `/etc/easy-mdm/easy-mdm.env` or the service-account file.

## Android Enterprise onboarding

1. Create a Google Cloud project and enable Android Management API.
2. Create a service account and grant only **Android Management User**.
3. Store its JSON key outside the repository with restricted file permissions.
4. Configure `GCP_PROJECT_ID`, `GCP_CREDENTIALS_PATH`, and `AMAPI_MODE=real`.
5. In Unitseek MDM, open **Settings → Tenant → Connect Android Enterprise** and complete Google's consent flow.
6. Request the initial Android Management API device quota before enrolling real devices.

The Google account used for enterprise binding should be controlled by the organization that will own the Android devices.

## Development

```bash
# Backend tests
cd backend
pytest

# Frontend production build
cd ../frontend
npm run build
```

The browser interface is intentionally English-only so operational teams get a consistent console experience.

## Security principles

- HTTPS-only production deployment and secure HttpOnly browser session cookies
- CSRF protection and bounded login-rate limiting
- Tenant-scoped access checks and audit records for sensitive device operations
- Least-privilege Google service account configuration
- Verified database TLS for Azure Database for MySQL deployments

Please report vulnerabilities privately; do not create a public issue for an exploitable security problem.

## Roadmap

- [x] Android Enterprise tenant connection
- [x] Device inventory, groups, policies, enrollment, managed apps, and audit history
- [x] Native systemd + Caddy deployment path
- [ ] More policy coverage and device compliance reporting
- [ ] Webhook-driven synchronization and operational alerting
- [ ] Public contribution and security-process documentation

## Contributing

Issues, bug reports, documentation improvements, and focused pull requests are welcome. For a useful bug report, include the expected behavior, actual behavior, anonymized logs, browser/device details, and reproducible steps.

## License and notices

Unitseek MDM is distributed under the [GNU Affero General Public License v3.0](LICENSE). It includes modified components whose original copyright and license notice are preserved in [NOTICE](NOTICE).

If you modify and provide this software to users over a network, AGPLv3 requires you to make the corresponding source available to those users.

---

If Unitseek MDM helps your team manage Android devices, consider giving the project a star. It makes the roadmap more visible and helps other self-hosting teams find it.
