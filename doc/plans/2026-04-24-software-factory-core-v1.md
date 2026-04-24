# Software Factory Core V1 Plan

Date: 2026-04-24
Status: Authoritative plan for the `feat/factory-core-v1` branch

## Purpose

This branch turns the Paperclip fork into the planning and control substrate for the software factory.

The software factory is **not** a new product repo and **not** a second control plane. It is the execution system that ingests project definition, resolves ambiguity, compiles a Critical DAG, emits execution-grade task specs, and later governs isolated implementation runs.

## Locked Direction

- Paperclip remains the control plane.
- Critical DAG / CCPM remains the scheduling model.
- Git worktrees remain the isolation primitive.
- Product repositories stay external to the Paperclip fork.
- Milestone 1 is **clarification + compilation**, not agent execution.

## Mapping onto Current Paperclip Concepts

The current repo already contains several useful primitives. This branch should build on them rather than pretending they do not exist.

- **Projects** remain the durable planning container for a factory-driven build.
- **Documents and work product** are the initial storage surface for PRDs, specs, architecture notes, generated manifests, and task packs.
- **Issues** remain the execution and ownership unit for implementation work after the factory has compiled the plan.
- **Approvals** remain the basis for architecture gates, phase gates, and later ship gates.
- **Project workspaces and execution workspaces** remain the eventual substrate for isolated implementation runs.

The thin-fork strategy is therefore:

1. lock the factory planning model inside the repo,
2. add core primitives only where the existing model is insufficient,
3. keep operator UX and execution helpers additive wherever possible.

## Milestone Order

### Milestone 1 — Clarification + Compilation

Required outcome:

`PRD -> questions -> decisions -> project.json -> task specs -> architecture gate`

This milestone proves that the factory can convert project definition into governed execution structure.

Included:

- project artifact registry model
- question queue model
- decision log model
- Critical DAG manifest contract
- task-spec generation contract
- architecture gate model

Explicitly excluded from this milestone:

- worktree launch orchestration
- background run tracking
- merge automation
- recovery of interrupted live execution

### Milestone 2 — Execution + Gates

Only after Milestone 1 is coherent.

Included later:

- worktree provisioning
- agent launch wiring
- execution manifest and metrics
- review verdict persistence
- resumability and recovery hooks

## What This Phase 0 Slice Delivers

This branch slice is intentionally narrow. It locks the interface before deeper implementation.

It delivers:

- the authoritative plan document in this repo
- a factory documentation pack under `doc/factory/`
- a committed sample `doc/factory/project.json`
- shared TypeScript + Zod contracts for the factory planning surface
- a targeted test that validates the sample manifest against the contract

It does **not** yet add database tables, routes, or UI tabs.

## Immediate Follow-on Work

After this slice lands, the next implementation branch steps should be:

1. add project-scoped artifact / question / decision / gate persistence in core,
2. expose Milestone 1 operator surfaces,
3. validate the full clarification pipeline on a real project,
4. only then start execution and recovery work.

## Guardrails

- Do not move product code into the fork.
- Do not rebuild a new issue tracker or approval system.
- Do not jump to execution before clarification and compilation are reliable.
- Do not hide factory decisions in chat logs; commit them as durable repo artifacts and later persist them as first-class project state.
