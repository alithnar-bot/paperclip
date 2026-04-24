# Project Status Handoff

Updated: 2026-04-24 08:27:45 UTC
Repo root: `/Users/halbot/work/.worktrees/paperclip-factory-core-v1`
Branch: `feat/factory-core-v1`

## Current status

- Phase 0: implemented
- Phase 1: implemented
- Phase 2: implemented
- Phase 3: started, not complete
- Nothing committed or pushed yet

## What was completed before this handoff

Already in the worktree before the latest Phase 3 attempt:

- factory planning pack under `doc/factory/`
- Phase 1 backend/shared/db slice
- Phase 2 compile route/service
- generated `project-json` + task-spec bundle flow
- passing targeted tests for the earlier phases

## What I completed in the latest Phase 3 session

1. Re-read repo and factory guidance:
   - `AGENTS.md`
   - `doc/factory/IMPLEMENTATION-PLAN.md`
   - `doc/factory/task-specs/FS-05.md`
2. Confirmed Claude Code delegation is still broken in this shell:
   - `claude auth status --text` looks fine
   - `claude -p ...` fails with `401 Invalid authentication credentials`
3. Identified the correct existing substrate to reuse rather than reinvent:
   - `server/src/services/workspace-runtime.ts`
   - `server/src/services/execution-workspaces.ts`
   - `server/src/services/workspace-operations.ts`
   - `server/src/services/execution-workspace-policy.ts`
4. Added failing Phase 3 tests first.
5. Started the shared contract changes for Phase 3.

## Important finding

Phase 3 should be a thin factory layer on top of Paperclip's existing execution workspace machinery.

Do **not** build a separate worktree engine.
Use the existing:

- execution workspace persistence
- git worktree realization
- cleanup helpers
- workspace operation recorder
- runtime service control

## Files touched in the latest Phase 3 session

- `server/src/__tests__/project-factory-service.test.ts`
- `server/src/__tests__/project-factory-routes.test.ts`
- `packages/shared/src/types/project-factory.ts`
- `packages/shared/src/validators/project-factory.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/validators/index.ts`
- `packages/shared/src/index.ts` ← currently needs repair

## What is currently broken

### 1. Shared root export file needs repair

`packages/shared/src/index.ts` was patched incorrectly around the project/factory export block.

The section around these exports needs to be re-read and repaired cleanly:

- `Project`
- `ProjectCodebase`
- `ProjectGoalRef`
- `ProjectWorkspace`
- `ProjectFactory*`
- related factory constants/types exports

### 2. One test was replaced instead of extended

In `server/src/__tests__/project-factory-service.test.ts`, the prior Phase 2 compile test was replaced by the new Phase 3 test instead of adding the new test alongside it.

Restore the compile test coverage before final validation.

### 3. Phase 3 implementation is still missing

These service/route pieces do not exist yet:

- `launchTaskExecution(...)`
- `listTaskExecutions(...)`
- `markTaskExecutionCompleted(...)`
- `archiveTaskExecution(...)`
- corresponding API routes
- execution manifest persistence
- factory task execution DB table + migration

## Last failing test state

These failures are expected and are the current restart point.

### Service test failure
From `server/src/__tests__/project-factory-service.test.ts`:

- `svc.launchTaskExecution is not a function`

### Route test failure
From `server/src/__tests__/project-factory-routes.test.ts`:

- `POST /api/projects/project-1/factory/executions` returned `404`
- expected `201`

## Intended Phase 3 shape

### New persistence
Add a factory task execution table, likely something like:

- `project_factory_task_executions`

Minimum fields:

- `id`
- `company_id`
- `project_id`
- `task_id`
- `task_name`
- `task_spec_artifact_key`
- `status`
- `execution_workspace_id`
- `project_workspace_id`
- `completion_marker`
- `completion_notes`
- `metadata`
- `launched_by_agent_id`
- `launched_by_user_id`
- `completed_by_agent_id`
- `completed_by_user_id`
- `launched_at`
- `completed_at`
- `archived_at`
- timestamps

### Shared surface
The Phase 3 shared types/validators should cover:

- task execution status
- task execution record
- execution manifest shape
- launch payload
- complete payload
- archive payload

### Service behavior
The factory service should:

1. resolve compiled manifest + task spec artifact
2. choose the primary project workspace
3. realize an isolated git worktree using existing runtime helpers
4. create an execution workspace record
5. create a factory task execution record
6. write a launch pack into the worktree, e.g.:
   - `.paperclip/factory/executions/<execution-id>/TASK.md`
   - `.paperclip/factory/executions/<execution-id>/execution.json`
7. persist/update an `execution-manifest` project artifact
8. mark complete when the completion marker matches
9. archive by cleaning up the worktree via existing cleanup helpers and archiving the execution workspace record

### Route surface to add
Recommended routes:

- `GET /api/projects/:id/factory/executions`
- `POST /api/projects/:id/factory/executions`
- `POST /api/projects/:id/factory/executions/:executionId/complete`
- `POST /api/projects/:id/factory/executions/:executionId/archive`

All mutating routes should remain board-only for now.
All mutations should log activity.

## Next exact steps

1. Repair `packages/shared/src/index.ts`.
2. Restore the displaced Phase 2 compile test in `server/src/__tests__/project-factory-service.test.ts`.
3. Add DB schema for factory task executions.
4. Export the new schema in `packages/db/src/schema/index.ts`.
5. Generate/fix the migration.
6. Extend `packages/shared/src/types/project-factory.ts` if needed after schema settles.
7. Extend `server/src/services/project-factory.ts` with:
   - `listTaskExecutions`
   - `launchTaskExecution`
   - `markTaskExecutionCompleted`
   - `archiveTaskExecution`
8. Extend `server/src/routes/projects.ts` with the new Phase 3 endpoints.
9. Add activity logging for launch/complete/archive.
10. Re-run targeted tests and then typecheck.

## Useful commands when resuming

Node is not on PATH by default in this Hermes shell, so prefix Node-based commands like this:

```bash
PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/vitest run server/src/__tests__/project-factory-service.test.ts server/src/__tests__/project-factory-routes.test.ts
PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit --pretty false
PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --pretty false
PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/tsc -p server/tsconfig.json --noEmit --pretty false
```

If using pnpm:

```bash
PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm --filter @paperclipai/shared typecheck
PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm --filter @paperclipai/db typecheck
PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm --filter @paperclipai/server typecheck
```

## Git state snapshot at handoff

At the point of this handoff, `git status --short` showed the worktree still contains uncommitted changes from the earlier phases plus the in-progress Phase 3 edits.

Do not assume the tree is clean.
Re-run `git status --short` before continuing.

## Restart point in one sentence

Restart by fixing `packages/shared/src/index.ts`, restoring the replaced Phase 2 test, then implementing Phase 3 as a thin factory task-execution layer on top of the existing execution workspace/worktree services.
