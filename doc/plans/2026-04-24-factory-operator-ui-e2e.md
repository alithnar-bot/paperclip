# Factory Operator UI + E2E Validation Implementation Plan

> **For Hermes:** Use subagent-driven-development for implementation, one task at a time, with review after each task.

**Goal:** Expose the factory control-plane state in the project UI and add one real end-to-end validation path that proves the Phase 0–5 stack works beyond raw API calls.

**Architecture:** Keep the server surface thin because the Phase 4/5 API already exists. Add a new project-level `Factory` tab in the React UI that consumes the existing review-state, operator-summary, recovery, and execution endpoints, then add a Playwright flow that seeds a factory project and verifies the operator can see and act on recovery state.

**Tech Stack:** React + TanStack Query + existing Paperclip UI components, shared types from `@paperclipai/shared`, existing `/api/projects/:id/factory/*` endpoints, Playwright E2E.

---

## Current Context

- Phase 0–5 backend work is now merged to `master`.
- Existing UI project tabs live in `ui/src/pages/ProjectDetail.tsx`.
- Existing project API client lives in `ui/src/api/projects.ts`.
- Existing query keys live in `ui/src/lib/queryKeys.ts`.
- Existing shared types already include:
  - `ProjectFactoryOperatorSummary`
  - `ProjectFactoryRecoverySummary`
  - `ProjectFactoryResumeTaskExecutionResult`
- Existing server routes already expose:
  - `GET /api/projects/:id/factory/executions`
  - `GET /api/projects/:id/factory/review-state`
  - `GET /api/projects/:id/factory/recovery`
  - `GET /api/projects/:id/factory/operator-summary`
  - `POST /api/projects/:id/factory/executions/:executionId/resume`
- Remaining gap from `doc/factory/IMPLEMENTATION-PLAN.md` is explicitly:
  - richer UI/operator dashboard surfaces beyond the API layer
  - broader end-to-end bootstrap demonstrations on real projects

## Proposed Slice

Ship the next slice in two parts:

1. **Operator UI surface inside Project Detail**
   - new `Factory` tab
   - operator summary cards
   - gate/review summary
   - execution list with status emphasis
   - recovery issue list with resume actions for resumable executions

2. **One proving E2E scenario**
   - seed a project into a factory-ready state via API helpers
   - open the Project Detail `Factory` tab
   - verify summary counts render correctly
   - trigger one resume action from the UI
   - verify the UI refreshes and recovery counts drop / execution status updates

This is enough to turn the merged backend into something an operator can actually use, without inventing a full standalone dashboard yet.

---

## Task 1: Extend the UI API client for factory surfaces

**Objective:** Add typed client methods for the existing factory endpoints.

**Files:**
- Modify: `ui/src/api/projects.ts`
- Modify: `ui/src/lib/queryKeys.ts`

**Implementation:**
- Import the shared types needed from `@paperclipai/shared`.
- Add query key helpers under `queryKeys.projects` for:
  - `factoryExecutions(projectId)`
  - `factoryReviewState(projectId)`
  - `factoryRecovery(projectId)`
  - `factoryOperatorSummary(projectId)`
- Add API client methods in `projectsApi` for:
  - `getFactoryExecutions(projectId, companyId?)`
  - `getFactoryReviewState(projectId, companyId?)`
  - `getFactoryRecovery(projectId, companyId?)`
  - `getFactoryOperatorSummary(projectId, companyId?)`
  - `resumeFactoryExecution(projectId, executionId, companyId?)`

**Verification:**
- Typecheck UI imports with `pnpm --filter @paperclipai/ui typecheck` if package filter exists, otherwise `pnpm -r typecheck`.
- Ensure no duplicate query-key names and no untyped `any` return values.

---

## Task 2: Add a Factory tab to the project page routing

**Objective:** Make factory state reachable from the existing project detail page.

**Files:**
- Modify: `ui/src/pages/ProjectDetail.tsx`

**Implementation:**
- Extend `ProjectBaseTab` with `"factory"`.
- Update `resolveProjectTab(...)` to recognize `/projects/:id/factory`.
- Update cached-tab restore logic so `factory` restores correctly.
- Update `handleTabChange(...)` to navigate to `/projects/${canonicalProjectRef}/factory`.
- Add a `Factory` item to `PageTabBar`.
- Keep the default tab as Issues for now; do not silently change navigation behavior.

**Verification:**
- Add or update a page-level test to assert the tab label renders and the route resolves.
- Confirm bare project URLs still default to Issues.

---

## Task 3: Build the project-level Factory content component

**Objective:** Render an operator-friendly view using the already-merged factory endpoints.

**Files:**
- Create: `ui/src/components/ProjectFactoryContent.tsx`
- Optionally create: `ui/src/components/ProjectFactoryRecoveryList.tsx`
- Optionally create: `ui/src/components/ProjectFactoryExecutionTable.tsx`
- Optionally create: `ui/src/components/ProjectFactoryGateSummary.tsx`
- Modify: `ui/src/pages/ProjectDetail.tsx`
- Reuse: `ui/src/components/MetricCard.tsx`

**Implementation:**
- Use `useQuery` for:
  - operator summary
  - review state
  - recovery summary
  - executions list
- Render a top summary row with counts for:
  - open questions
  - blocking questions
  - pending reviews
  - blocked gates
  - active executions
  - failed executions
  - recovery issues
- Render a gate/review section driven by review-state data.
- Render an execution list/table with strong emphasis on `active`, `failed`, `completed`, `archived`.
- Render a recovery issue list grouped by issue kind.
- For `resumable_execution`, show a `Resume` button wired to the resume mutation.
- On successful resume:
  - invalidate factory queries
  - show a toast
  - avoid optimistic state unless it is trivially correct
- Surface API failures explicitly; no silent fallbacks.

**Design constraints:**
- Prefer one coherent control panel over many scattered cards.
- Reuse existing visual patterns from project/workspace cards rather than inventing a new design language.
- Keep this page project-scoped, not company-global.

**Verification:**
- Component/page tests cover loading, empty, error, and success states.
- Resume button only appears for resumable issues.
- Resume success invalidates queries and updates visible counts.

---

## Task 4: Add UI tests for the new factory tab

**Objective:** Lock the operator UI behavior before broadening the slice.

**Files:**
- Create: `ui/src/pages/ProjectDetail.test.tsx` or `ui/src/components/ProjectFactoryContent.test.tsx`

**Implementation:**
- Mock `projectsApi` methods added in Task 1.
- Test these scenarios:
  1. Factory tab renders when project detail loads.
  2. Operator summary counts display correctly.
  3. Recovery issue list renders resumable and non-resumable issues distinctly.
  4. Clicking Resume calls `resumeFactoryExecution(...)` and invalidates/refetches.
  5. Error state shows a clear message.

**Verification:**
- Run the smallest targeted Vitest command for the new test file first.
- Then run the broader relevant UI test command.

---

## Task 5: Add one end-to-end factory proving flow

**Objective:** Demonstrate that the merged factory stack works through the operator UI, not just the API.

**Files:**
- Create: `tests/e2e/factory-operator.spec.ts`
- Read/reference: `tests/e2e/onboarding.spec.ts`
- Read/reference: `tests/e2e/signoff-policy.spec.ts`
- Read/reference: `tests/e2e/playwright.config.ts`

**Implementation approach:**
- Use Playwright request helpers to seed a company/project and prepare factory state.
- Prefer API setup over brittle UI setup for the initial scenario.
- Create or seed:
  - a project
  - compiled factory state / executions if needed
  - at least one failed execution with a surviving workspace path that can be resumed in test setup
- Visit the project `Factory` tab.
- Assert the operator summary metrics.
- Trigger Resume from the UI.
- Assert the page refreshes to reflect the resumed execution.

**Important constraint:**
- Keep the first E2E intentionally narrow. Do not try to simulate the full PRD-to-worktree lifecycle in the browser on day one.
- The first proof should validate visibility + recovery action, not the whole philosophy of autonomy.

**Verification:**
- Run `pnpm test:e2e -- --grep "factory operator"` or the nearest equivalent targeted Playwright invocation.
- If the E2E environment proves too heavy locally, keep the spec committed and document the exact blocker.

---

## Task 6: Documentation and handoff update

**Objective:** Make the next slice obvious to reviewers and future work.

**Files:**
- Modify: `doc/factory/IMPLEMENTATION-PLAN.md`
- Modify: `PROJECT-STATUS-HANDOFF.md`
- Optionally modify: `.github/PULL_REQUEST_TEMPLATE.md` only if the verification narrative needs a recurring factory-specific note (unlikely)

**Implementation:**
- Mark the UI/operator surface as the next follow-on slice once work starts landing.
- Record what the new E2E proves and what it still does not prove.

**Verification:**
- Docs accurately describe UI scope vs API scope.

---

## Suggested Implementation Order

1. API client + query keys
2. Project tab routing
3. Factory content component
4. UI tests
5. Playwright proving flow
6. Docs/handoff updates

---

## Validation Commands

Start with targeted checks:

```bash
pnpm --filter @paperclipai/shared typecheck
pnpm --filter @paperclipai/server typecheck
pnpm test:run -- ui/src/pages/ProjectDetail.test.tsx
pnpm test:run -- ui/src/components/ProjectFactoryContent.test.tsx
pnpm test:e2e -- --grep "factory operator"
```

If package-specific UI typecheck/test commands differ in this repo, use the existing nearest equivalents and record the exact commands in the PR.

Before handoff, run the full repo bar if feasible:

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

---

## Risks / Tradeoffs

- The operator UI may be tempted to become a mini-dashboard; resist that and keep it project-scoped.
- Recovery actions in UI can become misleading if the underlying local workspace path assumptions are not stable in E2E.
- A broad browser E2E that tries to compile/launch/resume everything will become brittle; keep the first scenario narrow and API-seeded.
- Query invalidation must be consistent or the UI will appear stale after resume.

## Open Questions

- Should the first operator surface live as a dedicated `Factory` tab, or as a section under `Overview`? My vote is a dedicated tab; it keeps the control-plane state explicit and avoids burying it under generic project fields.
- Should the first E2E prove compile + recovery together, or only recovery on pre-seeded state? Sensible default: recovery on pre-seeded state first, then broaden later.

## Recommended Next Commit Strategy

- Commit 1: UI API/query keys + Factory tab routing
- Commit 2: Factory content component + UI tests
- Commit 3: Playwright proving flow + doc updates
