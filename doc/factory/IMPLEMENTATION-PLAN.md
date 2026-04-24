# Paperclip Software Factory — Implementation Plan

## Goal

Deliver the first usable factory slice inside the Paperclip fork without bloating core or prematurely wiring execution.

## Build Order

### Phase 0 — Interface Lock

- factory documentation pack
- manifest contract
- question / decision / gate contracts
- task-pack decomposition

### Phase 1 — Intake + Decisions

- project artifact registry
- question persistence
- decision persistence
- operator-facing clarification flow

### Phase 2 — Compilation

- DAG compiler
- manifest generation
- task-spec generation
- architecture gate readiness

### Phase 3 — Execution Substrate

- worktree manager integration
- task launcher
- execution manifest
- completion marker handling

### Phase 4 — Review + Gates

- review packets
- verdict persistence
- phase blocking rules
- operator approval flows

### Phase 5 — Recovery + Operator View

- resumability
- orphan detection
- operator summary surfaces
- end-to-end bootstrap path

## Immediate Acceptance for This Slice

This branch slice is complete when:

1. the repo contains the factory pack,
2. the shared contract validates the sample manifest,
3. the task pack is aligned with the manifest,
4. Phase 0 is clearly separated from later implementation work.

## Current Implementation Status

Implemented inside the fork today:

- **Phase 0 — Interface Lock**
  - factory planning pack under `doc/factory/`
  - shared manifest / question / decision / gate contracts
- **Phase 1 — Intake + Decisions**
  - project artifact registry via project-linked documents
  - project-scoped question persistence
  - project-scoped decision persistence
  - intake summary generation
- **Phase 2 — Compilation**
  - project factory compile service and route
  - generated `project-json` artifact
  - generated task-spec bundle README
  - generated `task-spec-fs-00` through `task-spec-fs-07` artifacts

Still pending:

- execution substrate
- review + gates persistence beyond readiness scaffolding
- recovery / operator summary surfaces
