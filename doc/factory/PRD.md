# Paperclip Software Factory — PRD

Version: 0.1.0
Status: Phase 0 bootstrap

## Executive Summary

Build the execution system that turns project definition into governed software delivery.

The system must accept:

- a PRD,
- a technical specification,
- optional ontology or schema material,
- operator constraints and preferences,
- and answers to unresolved questions,

then produce:

- a clarified project record,
- durable decisions,
- a Critical DAG manifest,
- execution-grade task specs,
- gated progression rules,
- and later isolated worktree execution.

## Product Problem

AI-assisted delivery fails when the project definition remains ambiguous and execution stays informal.

Recurring failure modes:

- unresolved questions are rediscovered repeatedly,
- different agents infer different architectures,
- parallel work collides on shared files,
- review happens too late,
- the operator cannot see what is blocked and why.

The missing thing is not another coding agent. The missing thing is a control-and-execution system.

## Product Vision

The operator should experience a software factory rather than a collection of brittle sessions.

The factory should:

1. ingest project definition,
2. surface blocking ambiguity,
3. persist human answers as decisions,
4. compile a machine-readable project graph,
5. generate task specs,
6. hold progression behind explicit gates,
7. later execute work safely in isolated workspaces.

## Primary User

A technical founder, architect, or platform operator directing AI agents to build serious systems.

## Product Principles

1. Clarify before coding.
2. Lock shared-state interfaces before fan-out.
3. Parallelism is earned by clean decomposition.
4. Gates are explicit, not implied.
5. Every action should be auditable.
6. Human attention is reserved for consequential decisions.
7. Recovery must be designed in, not bolted on.

## Core Capabilities

- project artifact intake
- ambiguity detection and question queue
- durable decision log
- Critical DAG compiler
- task-spec generation
- architecture and phase gate model
- later: execution manifest, worktree orchestration, review, and recovery

## V1 Scope Boundary

The first serious milestone in this fork is **clarification + compilation**.

That means V1-in-this-branch is useful when it can:

1. accept PRD + tech spec artifacts,
2. identify blocking questions,
3. persist decisions,
4. generate a valid `project.json`,
5. emit task specs,
6. block progression pending architecture approval.

Live execution is a later milestone.
