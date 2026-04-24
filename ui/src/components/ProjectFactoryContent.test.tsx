// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  ProjectFactoryArtifact,
  ProjectFactoryOperatorSummary,
  ProjectFactoryRecoverySummary,
  ProjectFactoryReviewState,
  ProjectFactoryResumeTaskExecutionResult,
  ProjectFactoryTaskExecution,
} from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectFactoryContent } from "./ProjectFactoryContent";

const getFactoryExecutionsMock = vi.fn<(projectId: string, companyId?: string) => Promise<ProjectFactoryTaskExecution[]>>();
const getFactoryReviewStateMock = vi.fn<(projectId: string, companyId?: string) => Promise<ProjectFactoryReviewState>>();
const getFactoryRecoveryMock = vi.fn<(projectId: string, companyId?: string) => Promise<ProjectFactoryRecoverySummary>>();
const getFactoryOperatorSummaryMock = vi.fn<(projectId: string, companyId?: string) => Promise<ProjectFactoryOperatorSummary>>();
const getFactoryArtifactsMock = vi.fn<(projectId: string, companyId?: string) => Promise<ProjectFactoryArtifact[]>>();
const resumeFactoryExecutionMock = vi.fn<(projectId: string, executionId: string, companyId?: string) => Promise<ProjectFactoryResumeTaskExecutionResult>>();
const pushToastMock = vi.fn();

vi.mock("../api/projects", () => ({
  projectsApi: {
    getFactoryExecutions: (projectId: string, companyId?: string) => getFactoryExecutionsMock(projectId, companyId),
    getFactoryReviewState: (projectId: string, companyId?: string) => getFactoryReviewStateMock(projectId, companyId),
    getFactoryRecovery: (projectId: string, companyId?: string) => getFactoryRecoveryMock(projectId, companyId),
    getFactoryOperatorSummary: (projectId: string, companyId?: string) => getFactoryOperatorSummaryMock(projectId, companyId),
    getFactoryArtifacts: (projectId: string, companyId?: string) => getFactoryArtifactsMock(projectId, companyId),
    resumeFactoryExecution: (projectId: string, executionId: string, companyId?: string) =>
      resumeFactoryExecutionMock(projectId, executionId, companyId),
  },
}));

vi.mock("../context/ToastContext", () => ({
  useToastActions: () => ({ pushToast: pushToastMock }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const now = new Date("2026-04-24T14:00:00.000Z");

function createExecution(overrides: Partial<ProjectFactoryTaskExecution> = {}): ProjectFactoryTaskExecution {
  return {
    id: overrides.id ?? "execution-1",
    companyId: overrides.companyId ?? "company-1",
    projectId: overrides.projectId ?? "project-1",
    taskId: overrides.taskId ?? "FS-06",
    taskName: overrides.taskName ?? "Review and gates",
    taskSpecArtifactKey: overrides.taskSpecArtifactKey ?? "task-spec-fs-06",
    status: overrides.status ?? "active",
    executionWorkspaceId: overrides.executionWorkspaceId ?? "workspace-1",
    projectWorkspaceId: overrides.projectWorkspaceId ?? "project-workspace-1",
    workspaceMode: overrides.workspaceMode ?? "isolated_workspace",
    workspaceStrategyType: overrides.workspaceStrategyType ?? "git_worktree",
    workspaceProviderType: overrides.workspaceProviderType ?? "git_worktree",
    workspaceName: overrides.workspaceName ?? "FS-06 workspace",
    branchName: overrides.branchName ?? "factory/fs-06",
    worktreePath: overrides.worktreePath ?? "/tmp/factory/fs-06",
    completionMarker: overrides.completionMarker ?? null,
    completionNotes: overrides.completionNotes ?? null,
    metadata: overrides.metadata ?? null,
    launchedByAgentId: overrides.launchedByAgentId ?? null,
    launchedByUserId: overrides.launchedByUserId ?? null,
    completedByAgentId: overrides.completedByAgentId ?? null,
    completedByUserId: overrides.completedByUserId ?? null,
    launchedAt: overrides.launchedAt ?? now,
    completedAt: overrides.completedAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    executionWorkspace: overrides.executionWorkspace ?? null,
  };
}

function createRecoverySummary(overrides: Partial<ProjectFactoryRecoverySummary> = {}): ProjectFactoryRecoverySummary {
  return {
    projectId: overrides.projectId ?? "project-1",
    issueCount: overrides.issueCount ?? 2,
    resumableExecutionCount: overrides.resumableExecutionCount ?? 1,
    orphanWorkspaceCount: overrides.orphanWorkspaceCount ?? 0,
    issues:
      overrides.issues ?? [
        {
          kind: "resumable_execution",
          executionId: "execution-failed",
          taskId: "FS-07",
          executionWorkspaceId: "workspace-failed",
          workspaceName: "FS-07 workspace",
          workspaceStatus: "cleanup_failed",
          resumable: true,
          message: "Execution can be resumed from its surviving workspace.",
        },
        {
          kind: "cleanup_failed_workspace",
          executionId: null,
          taskId: null,
          executionWorkspaceId: "workspace-stuck",
          workspaceName: "Stuck workspace",
          workspaceStatus: "cleanup_failed",
          resumable: false,
          message: "Workspace cleanup needs manual attention.",
        },
      ],
  };
}

function createOperatorSummary(overrides: Partial<ProjectFactoryOperatorSummary> = {}): ProjectFactoryOperatorSummary {
  const recovery = overrides.recovery ?? createRecoverySummary();
  return {
    projectId: overrides.projectId ?? "project-1",
    openQuestionCount: overrides.openQuestionCount ?? 3,
    blockingQuestionCount: overrides.blockingQuestionCount ?? 1,
    pendingGateCount: overrides.pendingGateCount ?? 1,
    blockedGateCount: overrides.blockedGateCount ?? 1,
    approvedGateCount: overrides.approvedGateCount ?? 2,
    pendingReviewCount: overrides.pendingReviewCount ?? 1,
    activeExecutionCount: overrides.activeExecutionCount ?? 1,
    failedExecutionCount: overrides.failedExecutionCount ?? 1,
    recoveryIssueCount: overrides.recoveryIssueCount ?? recovery.issueCount,
    resumableExecutionCount: overrides.resumableExecutionCount ?? recovery.resumableExecutionCount,
    orphanWorkspaceCount: overrides.orphanWorkspaceCount ?? recovery.orphanWorkspaceCount,
    recovery,
  };
}

function createReviewState(overrides: Partial<ProjectFactoryReviewState> = {}): ProjectFactoryReviewState {
  return {
    projectId: overrides.projectId ?? "project-1",
    gates:
      overrides.gates ?? [
        {
          gateId: "gate-architecture",
          phaseId: "P4",
          title: "Architecture review",
          blocking: true,
          defaultStatus: "pending",
          effectiveStatus: "blocked",
          latestEvaluation: {
            id: "evaluation-1",
            companyId: "company-1",
            projectId: "project-1",
            gateId: "gate-architecture",
            phaseId: "P4",
            status: "blocked",
            summary: "Waiting for review corrections.",
            decidedByAgentId: null,
            decidedByUserId: "user-1",
            decidedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      ],
    evaluations: overrides.evaluations ?? [],
    executionReviewSummaries:
      overrides.executionReviewSummaries ?? [
        {
          executionId: "execution-failed",
          taskId: "FS-07",
          reviewCount: 2,
          latestVerdict: "changes_requested",
          latestReviewedAt: now,
        },
      ],
  };
}

function createFactoryArtifact(overrides: Partial<ProjectFactoryArtifact> = {}): ProjectFactoryArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    companyId: overrides.companyId ?? "company-1",
    projectId: overrides.projectId ?? "project-1",
    key: overrides.key ?? "project-json",
    kind: overrides.kind ?? "dag_manifest",
    required: overrides.required ?? true,
    sourcePath: overrides.sourcePath ?? "generated/project.json",
    description: overrides.description ?? "Generated Critical DAG manifest for the project factory.",
    title: overrides.title ?? "Compiled project.json",
    format: overrides.format ?? "json",
    latestRevisionId: overrides.latestRevisionId ?? "revision-1",
    latestRevisionNumber: overrides.latestRevisionNumber ?? 1,
    createdByAgentId: overrides.createdByAgentId ?? null,
    createdByUserId: overrides.createdByUserId ?? "user-1",
    updatedByAgentId: overrides.updatedByAgentId ?? null,
    updatedByUserId: overrides.updatedByUserId ?? "user-1",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    body:
      overrides.body ?? JSON.stringify({
        id: "project-1",
        name: "Factory Operator Localhost Project",
        version: "1.0.0",
        status: "active",
        risk: "medium",
        methodology: "ccpm-dag",
        description: "Compiled factory manifest",
        phases: [
          { id: "P0", name: "Interface Lock", description: null },
          { id: "P2", name: "Compilation", description: null },
          { id: "P4", name: "Execution Substrate", description: null },
        ],
        artifacts: [],
        questions: [],
        decisions: [],
        gates: [],
        chain: {
          totalTasks: 3,
          completedTasks: 1,
          tasks: [
            {
              id: "FS-00",
              name: "Interface lock",
              phaseId: "P0",
              wave: 0,
              status: "done",
              estimateMin: 90,
              dependsOn: [],
              onCriticalPath: true,
              acceptance: ["Contract locked"],
            },
            {
              id: "FS-03",
              name: "Critical DAG compiler and manifest generation",
              phaseId: "P2",
              wave: 1,
              status: "todo",
              estimateMin: 150,
              dependsOn: ["FS-00"],
              onCriticalPath: true,
              acceptance: ["Valid manifest generated"],
            },
            {
              id: "FS-05",
              name: "Parallel execution substrate",
              phaseId: "P4",
              wave: 2,
              status: "todo",
              estimateMin: 120,
              dependsOn: ["FS-03"],
              onCriticalPath: false,
              acceptance: ["Launch path exists"],
            },
          ],
        },
      }, null, 2),
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("ProjectFactoryContent", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    getFactoryArtifactsMock.mockResolvedValue([]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders operator summary metrics, gate state, executions, and recovery issues", async () => {
    getFactoryOperatorSummaryMock.mockResolvedValue(createOperatorSummary());
    getFactoryReviewStateMock.mockResolvedValue(createReviewState());
    getFactoryRecoveryMock.mockResolvedValue(createRecoverySummary());
    getFactoryExecutionsMock.mockResolvedValue([
      createExecution({ id: "execution-active", taskId: "FS-06", taskName: "Review and gates", status: "active" }),
      createExecution({ id: "execution-failed", taskId: "FS-07", taskName: "Recovery and operator view", status: "failed" }),
    ]);

    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectFactoryContent companyId="company-1" projectId="project-1" projectRef="project-alpha" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Factory control panel");
    expect(container.textContent).toContain("Open questions");
    expect(container.textContent).toContain("Blocking questions");
    expect(container.textContent).toContain("Pending reviews");
    expect(container.textContent).toContain("Recovery issues");
    expect(container.textContent).toContain("Architecture review");
    expect(container.textContent).toContain("Waiting for review corrections.");
    expect(container.textContent).toContain("Review and gates");
    expect(container.textContent).toContain("Recovery and operator view");
    expect(container.textContent).toContain("Execution can be resumed from its surviving workspace.");
    expect(container.querySelector('button[data-testid="resume-execution-execution-failed"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("renders the compiled critical DAG when a project-json factory artifact is available", async () => {
    getFactoryOperatorSummaryMock.mockResolvedValue(createOperatorSummary());
    getFactoryReviewStateMock.mockResolvedValue(createReviewState());
    getFactoryRecoveryMock.mockResolvedValue(createRecoverySummary());
    getFactoryExecutionsMock.mockResolvedValue([]);
    getFactoryArtifactsMock.mockResolvedValue([createFactoryArtifact()]);

    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectFactoryContent companyId="company-1" projectId="project-1" projectRef="project-alpha" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Critical DAG");
    expect(container.textContent).toContain("Methodology");
    expect(container.textContent).toContain("ccpm dag");
    expect(container.textContent).toContain("Critical path");
    expect(container.textContent).toContain("Critical DAG compiler and manifest generation");
    expect(container.textContent).toContain("Wave 1");
    expect(container.textContent).toContain("FS-03");
    expect(container.textContent).toContain("Depends on FS-00");

    await act(async () => {
      root.unmount();
    });
  });

  it("resumes a failed execution and refreshes the visible recovery state", async () => {
    const initialRecovery = createRecoverySummary();
    const updatedRecovery = createRecoverySummary({
      issueCount: 1,
      resumableExecutionCount: 0,
      issues: [
        {
          kind: "cleanup_failed_workspace",
          executionId: null,
          taskId: null,
          executionWorkspaceId: "workspace-stuck",
          workspaceName: "Stuck workspace",
          workspaceStatus: "cleanup_failed",
          resumable: false,
          message: "Workspace cleanup needs manual attention.",
        },
      ],
    });

    getFactoryOperatorSummaryMock
      .mockResolvedValueOnce(createOperatorSummary({ recovery: initialRecovery, recoveryIssueCount: 2, resumableExecutionCount: 1, failedExecutionCount: 1, activeExecutionCount: 1 }))
      .mockResolvedValue(createOperatorSummary({ recovery: updatedRecovery, recoveryIssueCount: 1, resumableExecutionCount: 0, failedExecutionCount: 0, activeExecutionCount: 2 }));
    getFactoryReviewStateMock.mockResolvedValue(createReviewState());
    getFactoryRecoveryMock.mockResolvedValueOnce(initialRecovery).mockResolvedValue(updatedRecovery);
    getFactoryExecutionsMock
      .mockResolvedValueOnce([
        createExecution({ id: "execution-active", taskId: "FS-06", taskName: "Review and gates", status: "active" }),
        createExecution({ id: "execution-failed", taskId: "FS-07", taskName: "Recovery and operator view", status: "failed" }),
      ])
      .mockResolvedValue([
        createExecution({ id: "execution-active", taskId: "FS-06", taskName: "Review and gates", status: "active" }),
        createExecution({ id: "execution-failed", taskId: "FS-07", taskName: "Recovery and operator view", status: "active" }),
      ]);
    resumeFactoryExecutionMock.mockResolvedValue({
      execution: createExecution({ id: "execution-failed", taskId: "FS-07", taskName: "Recovery and operator view", status: "active" }),
      executionWorkspace: null,
      executionManifestKey: "execution-manifest",
    });

    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectFactoryContent companyId="company-1" projectId="project-1" projectRef="project-alpha" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    const resumeButton = container.querySelector('button[data-testid="resume-execution-execution-failed"]');
    expect(resumeButton).not.toBeNull();

    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();
    await flushReact();

    expect(resumeFactoryExecutionMock).toHaveBeenCalledWith("project-1", "execution-failed", "company-1");
    expect(getFactoryOperatorSummaryMock.mock.calls.length).toBeGreaterThan(1);
    expect(container.textContent).not.toContain("Execution can be resumed from its surviving workspace.");
    expect(container.querySelector('button[data-testid="resume-execution-execution-failed"]')).toBeNull();
    expect(pushToastMock).toHaveBeenCalledWith(expect.objectContaining({ tone: "success" }));

    await act(async () => {
      root.unmount();
    });
  });

  it("surfaces API failures clearly", async () => {
    getFactoryOperatorSummaryMock.mockRejectedValue(new Error("operator summary failed"));
    getFactoryReviewStateMock.mockResolvedValue(createReviewState());
    getFactoryRecoveryMock.mockResolvedValue(createRecoverySummary());
    getFactoryExecutionsMock.mockResolvedValue([]);

    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectFactoryContent companyId="company-1" projectId="project-1" projectRef="project-alpha" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("operator summary failed");

    await act(async () => {
      root.unmount();
    });
  });
});
