# 社保公积金前端验收追踪

Updated: `2026-07-26`

Scope: frontend session only. This trace does not claim backend persistence, official-platform acceptance, production policy accuracy, regulated-data authorization, or audit-grade evidence.

| ID | Frontend evidence | Status |
| --- | --- | --- |
| SI-01 | `buildDerivedEnrollmentProfiles` creates pending enrollment from full-time employment | automated |
| SI-02 | probation remains full-time employment obligation | automated |
| SI-03 | missing official enrollment remains `尚未增员`, not exempt | automated |
| SI-04 | independent labor relation records structured no-obligation reason and is excluded | automated |
| SI-05 | non-full-time employment is not excluded by the display personnel type | automated |
| SI-06 | monthly candidates start from official effective month | automated |
| SI-07 | channel-specific stop-effective month excludes that channel while historical relationship and other channels remain intact | automated |
| SI-08 | official no-contribution registration requires the relevant channel stop result and evidence; housing fund does not reuse social stop facts | domain + UI |
| SI-09 | pending stop result retains contribution obligation | domain + UI |
| SI-10 | official no-contribution result preserves reference, reason, date and files | domain + UI |
| SI-11 | annual contribution base resolves by effective period and clamps limits | automated |
| SI-12 | new-employee base requires an explicit contribution-base record | automated |
| SI-13 | historical calculation resolves period policy version; seeded item details freeze their category-specific policy ID | automated |
| SI-14 | policy model supports period parameters; official injury-rate source remains external | partial |
| SI-15 | equal official assessment can enter formal confirmation | automated |
| SI-16 | assessment difference requires reason before confirmation | automated |
| SI-17 | official assessment number and evidence file are mandatory | automated |
| SI-18 | assessed `待缴费` personal amount enters payroll before actual payment | automated |
| SI-19 | estimate and pending assessment do not enter payroll | automated |
| SI-20 | payment creates one pending-review cash flow; contribution stays open until review posts the flow, then clears split liabilities | automated |
| SI-21 | arrears correction preserves original and handling periods | automated |
| SI-22 | employer principal, employee principal and late fee remain separate | automated |
| SI-23 | employee principal creates a handling-period after-tax salary recovery only when evidenced correction payment is registered and does not overwrite paid salary | domain + UI |
| SI-24 | correction payment carries liability/late-fee accounting allocation; persisted voucher correction is pending backend | partial |
| SI-25 | social-security, medical-insurance and housing-fund effective/stop results, references and evidence remain separate | automated |
| SI-26 | housing-fund applicability and stop result do not alter social-insurance obligation or evidence | automated |
| SI-27 | providers share one same-session state across routes; refresh persistence is pending backend | partial |
| SI-28 | list minimization and shared file preview/download are implemented; backend authorization is pending | manual + partial |
| SI-29 | salary and period-close consumers resolve contribution rows by requested accounting month instead of a fixed display month | automated + source contract |
| SI-30 | a later departure does not erase contribution eligibility in an earlier active month | automated |
| SI-31 | formal monthly social-insurance and housing-fund records are the salary source of truth; stale personnel archive summaries cannot override them | automated |
| SI-32 | employee correction principal is recovered after tax through other receivables and does not reduce payroll cost or taxable income | automated |
| SI-33 | an assessed current-period contribution in `待缴费` no longer waits for a later cash payment before period close | automated |
| SI-34 | unassessed, disputed and arrears contribution facts still block period close; same-period pending cash review remains an independent blocker | automated |

Named automated evidence in `financeSocialInsuranceModel.test.ts`:

- `saves each enrollment channel without mutating the other handling facts`
- `keeps historical relationship eligibility after a later departure`
- `evaluates social insurance medical insurance and housing fund intervals independently`
- `freezes category-specific policy versions on seeded contribution details`
- `creates an arrears payment with employer expense employee receivable and late-fee allocations`

Named automated evidence in `salaryDomain.test.ts`:

- `uses the formal housing-fund monthly record when the personnel archive summary is stale`
- `recovers employee contribution advances after tax without reducing payroll cost or taxable income`

Named automated evidence in `financePeriodCloseModel.test.ts`:

- `resolves social-insurance close checks by each target accounting period`
- `accepts assessed unpaid paid and officially exempt social-insurance records for close`
- `keeps next-period contribution payment review out of the original obligation period`

Verification commands:

```text
corepack pnpm --filter @startupmanage/web typecheck
corepack pnpm --filter @startupmanage/web test
corepack pnpm build:web
corepack pnpm ai-native:check
```
