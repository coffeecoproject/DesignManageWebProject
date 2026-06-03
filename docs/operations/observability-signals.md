# Observability Signals

## 1. Status

Status: `planned_gap`.

No runtime logs, metrics, traces, error reporting, dashboards, alerts, sampling, or retention controls exist yet.

## 2. Signal Inventory

| Signal | Purpose | Runtime unit | Tool | Retention | Alert | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| frontend errors | TBD | frontend | TBD | TBD | TBD | TBD | planned_gap |
| API errors | TBD | API | TBD | TBD | TBD | TBD | planned_gap |
| job failures | TBD | worker/scheduler | TBD | TBD | TBD | TBD | planned_gap |

## 3. Logging Rules

- Do not log secrets, tokens, credentials, or sensitive personal data.
- Logging format and redaction rules must be defined before operational readiness.
- Alerts and dashboards require evidence before release readiness.

## 4. Required Future Evidence

- Real log/error/metric/trace configuration.
- Dashboard links or screenshots.
- Alert rules and test evidence.
- Runbook and incident escalation path.
