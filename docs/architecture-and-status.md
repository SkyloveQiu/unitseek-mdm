# Architecture and project status

Unitseek MDM is an independently maintained, self-hosted Android Enterprise management console. It uses React for the operator interface, FastAPI for the API, and the Google Android Management API for device management.

## Runtime architecture

```text
React console → FastAPI API → Google Android Management API → Android Device Policy
                    │
                    └→ SQL database
```

The native production deployment runs the API as a restricted systemd service behind Caddy. Caddy serves the static frontend, proxies API and health requests, and terminates HTTPS. Persistent state is stored in a separate SQL service, not on the application VM.

## Current capabilities

- Tenant connection to Android Enterprise
- Fully managed and dedicated enrollment tokens with QR provisioning
- Device inventory, device groups, policies, managed applications, and audit records
- Remote commands with explicit destructive-action confirmation
- Periodic small-fleet synchronization and readiness checks
- Azure Database for MySQL support with verified TLS
- English-only administration interface

## Before production enrollment

An operator still needs a Google Cloud project with Android Management API enabled, a least-privilege service account, an Android Enterprise binding, and applicable device quota. Validate real-device enrollment and policy behavior with a factory-reset test device before managing a production fleet.
