# 社保公积金前端验收追踪

Updated: `2026-07-20`

Scope: frontend session only. This trace does not claim backend persistence, official-platform acceptance, production policy accuracy, regulated-data authorization, or audit-grade evidence.

| ID | Frontend evidence | Status |
| --- | --- | --- |
| SI-01 | `buildDerivedEnrollmentProfiles` creates pending enrollment from full-time employment | automated |
| SI-02 | probation remains full-time employment obligation | automated |
| SI-03 | missing official enrollment remains `尚未增员`, not exempt | automated |
| SI-04 | independent labor relation records structured no-obligation reason and is excluded | automated |
| SI-05 | non-full-time employment is not excluded by the display personnel type | automated |
| SI-06 | monthly candidates start from official effective month | automated |
| SI-07 | stop-effective month excludes later candidate while prior month remains payable | automated |
| SI-08 | official no-contribution registration requires stop result and evidence | domain + UI |
| SI-09 | pending stop result retains contribution obligation | domain + UI |
| SI-10 | official no-contribution result preserves reference, reason, date and files | domain + UI |
| SI-11 | annual contribution base resolves by effective period and clamps limits | automated |
| SI-12 | new-employee base requires an explicit contribution-base record | automated |
| SI-13 | historical calculation resolves period policy version | automated |
| SI-14 | policy model supports period parameters; official injury-rate source remains external | partial |
| SI-15 | equal official assessment can enter formal confirmation | automated |
| SI-16 | assessment difference requires reason before confirmation | automated |
| SI-17 | official assessment number and evidence file are mandatory | automated |
| SI-18 | assessed `待缴费` personal amount enters payroll before actual payment | automated |
| SI-19 | estimate and pending assessment do not enter payroll | automated |
| SI-20 | payment creates one pending-review cash flow; contribution stays open until review posts the flow, then clears split liabilities | automated |
| SI-21 | arrears correction preserves original and handling periods | automated |
| SI-22 | employer principal, employee principal and late fee remain separate | automated |
| SI-23 | employee principal creates handling-period salary adjustment and does not overwrite paid salary | domain + UI |
| SI-24 | correction payment carries liability/late-fee accounting allocation; persisted voucher correction is pending backend | partial |
| SI-25 | social-security and medical-insurance effective/stop results remain separate | automated |
| SI-26 | housing-fund applicability does not alter social-insurance obligation | automated |
| SI-27 | providers share one same-session state across routes; refresh persistence is pending backend | partial |
| SI-28 | list minimization and shared file preview/download are implemented; backend authorization is pending | manual + partial |

Verification commands:

```text
corepack pnpm --filter @startupmanage/web typecheck
corepack pnpm --filter @startupmanage/web test
corepack pnpm build:web
corepack pnpm ai-native:check
```
