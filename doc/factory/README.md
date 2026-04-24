# Paperclip Software Factory Pack

Status: Phase 0 / interface lock

This directory is the authoritative planning pack for turning the Paperclip fork into a software factory.

It is intentionally a **bootstrap pack**, not the finished implementation.

## What This Pack Locks

- the factory product definition
- the technical contract for Milestone 1
- the architecture boundaries between Paperclip core and factory extensions
- the durable decisions already made
- the implementation order
- the initial factory manifest and task pack

## Read Order

1. `PRD.md`
2. `TECH-SPEC.md`
3. `ARCHITECTURE.md`
4. `DECISIONS.md`
5. `IMPLEMENTATION-PLAN.md`
6. `project.json`
7. `task-specs/README.md`

## Scope of This Slice

This pack covers Phase 0 only:

- interface lock
- artifact pack
- manifest contract
- initial task decomposition

It does **not** claim that the backend, UI, or database factory primitives exist yet.

## Direction

- Paperclip is the control plane.
- Critical DAG is the planning and scheduling model.
- Git worktrees are the isolation primitive for later execution.
- Product repositories remain external to this fork.
