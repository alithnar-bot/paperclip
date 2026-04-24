# Paperclip Software Factory — Architecture

## Summary

The factory has three logical layers.

### 1. Control layer

Owns:

- project artifact registry
- question queue
- decision log
- gate state
- operator visibility

In the broader system, Paperclip remains the control plane host for these concepts.

### 2. Compilation layer

Owns:

- intake normalization
- ambiguity analysis
- Critical DAG compilation
- manifest generation
- task-spec generation

This is the differentiating logic of the factory.

### 3. Execution layer

Owns later:

- worktree lifecycle
- task launch
- review packets
- gate enforcement
- manifest / metrics / recovery

## Integration Boundaries

- **Paperclip** provides project, issue, approval, workspace, and operator-control primitives.
- **Factory core** adds the missing clarification and compilation logic.
- **Coding agents** execute generated tasks later in isolated workspaces.

## Design Rules

- Keep the fork thin.
- Put true control-plane primitives in core.
- Keep optional operator surfaces and helpers additive.
- Keep product repositories outside this repo.
