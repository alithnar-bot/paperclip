# Paperclip Software Factory — Decisions

## Locked Decisions

### FD-001 — Control plane choice
Paperclip is the control plane. We extend it instead of building a second control plane from scratch.

### FD-002 — Scheduling model
The factory uses Critical DAG / CCPM-style orchestration: serial within shared state, parallel across isolated state.

### FD-003 — Isolation primitive
Git worktrees are the default isolation primitive for executable tasks.

### FD-004 — Product repo separation
Product repositories remain external to the Paperclip fork. The fork orchestrates them; it does not absorb them.

### FD-005 — Milestone order
Milestone 1 is clarification + compilation. Execution comes later.

### FD-006 — Gate model
Architecture and phase gates are first-class governed states, not informal comments.

### FD-007 — Interface lock requirement
`project.json` and the task pack must exist before execution work begins.

## Change Rule

Add later decisions with:

- identifier
- date
- summary
- rationale
- affected surfaces
