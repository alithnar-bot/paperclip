# Factory Task Pack

These task specs decompose the software factory build inside the Paperclip fork.

## Reading Order

1. `../PRD.md`
2. `../TECH-SPEC.md`
3. `../ARCHITECTURE.md`
4. `../DECISIONS.md`
5. `../IMPLEMENTATION-PLAN.md`
6. `../project.json`
7. the assigned task spec

## Rule

No task may invent shared-state architecture in isolation. The docs and manifest lock the contract first.

## Task Set

- `FS-00.md` — interface lock and contract pack
- `FS-01.md` — artifact registry and intake normalization
- `FS-02.md` — question queue and decision log
- `FS-03.md` — Critical DAG compiler and manifest generation
- `FS-04.md` — task-spec generation
- `FS-05.md` — execution substrate and worktree manager
- `FS-06.md` — review and gate evaluator
- `FS-07.md` — recovery and operator summary
