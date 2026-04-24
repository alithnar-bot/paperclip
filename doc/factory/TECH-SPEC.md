# Paperclip Software Factory — Technical Specification

Version: 0.1.0
Status: Phase 0 bootstrap

## Scope

This document defines the factory planning surface that will later be implemented inside the Paperclip fork.

## Core Subsystems

1. **Artifact intake**
   - register PRDs, specs, architecture notes, ontology docs, manifests, and reports as project artifacts
2. **Question engine**
   - classify unresolved ambiguity into blocking and non-blocking questions
3. **Decision store**
   - persist answers and supersessions as durable execution decisions
4. **Critical DAG compiler**
   - turn clarified requirements into phases, gates, tasks, dependencies, waves, and acceptance criteria
5. **Task-spec generator**
   - render execution-grade specs for each DAG task
6. **Gate model**
   - track architecture approval, phase gates, and later ship gates
7. **Execution substrate**
   - deferred in this slice; later provides worktree lifecycle, launcher wiring, metrics, and recovery

## Mapping to Current Paperclip Surfaces

- **Projects** anchor the overall factory initiative.
- **Documents / work product** hold the initial artifact set and generated outputs.
- **Issues** remain the downstream execution unit once the factory emits build tasks.
- **Approvals** become the governed gate mechanism.
- **Project workspaces / execution workspaces** remain the future execution substrate.

## Phase 0 Contract

This slice locks only the planning contract:

- `doc/factory/project.json` as the sample manifest
- shared TypeScript + Zod schemas for the manifest, questions, decisions, and gates
- task-pack documents for FS-00 through FS-07

## Future Persistence Targets

Later core additions should persist at least:

- project artifacts
- project questions
- project decisions
- project gates
- generated factory manifests

## Validation Expectations

The contract should reject:

- task dependencies that reference missing tasks,
- gate phases that do not exist,
- question references to missing decisions,
- mismatched `totalTasks` and actual task count.
