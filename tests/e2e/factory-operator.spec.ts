import { test, expect } from "@playwright/test";

const COMPANY_NAME = `Factory Operator ${Date.now()}`;
const PROJECT_NAME = "Factory Operator Project";

function buildReviewState(nowIso: string) {
  return {
    projectId: "project-placeholder",
    gates: [
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
          projectId: "project-placeholder",
          gateId: "gate-architecture",
          phaseId: "P4",
          status: "blocked",
          summary: "Waiting for recovery follow-up.",
          decidedByAgentId: null,
          decidedByUserId: "user-1",
          decidedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
    ],
    evaluations: [],
    executionReviewSummaries: [
      {
        executionId: "execution-failed",
        taskId: "FS-07",
        reviewCount: 1,
        latestVerdict: "changes_requested",
        latestReviewedAt: nowIso,
      },
    ],
  };
}

test.describe("factory operator tab", () => {
  test("renders factory recovery state and updates after a resume action", async ({ page }) => {
    let companyId: string | null = null;

    try {
      const companyRes = await page.request.post("/api/companies", {
        data: { name: COMPANY_NAME },
      });
      expect(companyRes.ok()).toBe(true);
      const company = await companyRes.json();
      companyId = company.id;

      const projectRes = await page.request.post(`/api/companies/${company.id}/projects`, {
        data: { name: PROJECT_NAME, status: "in_progress" },
      });
      expect(projectRes.ok()).toBe(true);
      const project = await projectRes.json();

      const projectRef = project.urlKey ?? project.id;
      const nowIso = new Date("2026-04-24T14:30:00.000Z").toISOString();
      let resumed = false;

    const initialRecovery = {
      projectId: project.id,
      issueCount: 1,
      resumableExecutionCount: 1,
      orphanWorkspaceCount: 0,
      issues: [
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
      ],
    };

    const updatedRecovery = {
      projectId: project.id,
      issueCount: 0,
      resumableExecutionCount: 0,
      orphanWorkspaceCount: 0,
      issues: [],
    };

    const initialExecutions = [
      {
        id: "execution-active",
        companyId: company.id,
        projectId: project.id,
        taskId: "FS-06",
        taskName: "Review and gates",
        taskSpecArtifactKey: "task-spec-fs-06",
        status: "active",
        executionWorkspaceId: "workspace-active",
        projectWorkspaceId: "project-workspace-1",
        workspaceMode: "isolated_workspace",
        workspaceStrategyType: "git_worktree",
        workspaceProviderType: "git_worktree",
        workspaceName: "FS-06 workspace",
        branchName: "factory/fs-06",
        worktreePath: "/tmp/factory/fs-06",
        completionMarker: null,
        completionNotes: null,
        metadata: null,
        launchedByAgentId: null,
        launchedByUserId: null,
        completedByAgentId: null,
        completedByUserId: null,
        launchedAt: nowIso,
        completedAt: null,
        archivedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "execution-failed",
        companyId: company.id,
        projectId: project.id,
        taskId: "FS-07",
        taskName: "Recovery and operator view",
        taskSpecArtifactKey: "task-spec-fs-07",
        status: "failed",
        executionWorkspaceId: "workspace-failed",
        projectWorkspaceId: "project-workspace-1",
        workspaceMode: "isolated_workspace",
        workspaceStrategyType: "git_worktree",
        workspaceProviderType: "git_worktree",
        workspaceName: "FS-07 workspace",
        branchName: "factory/fs-07",
        worktreePath: "/tmp/factory/fs-07",
        completionMarker: null,
        completionNotes: "Launch pack write failed earlier.",
        metadata: null,
        launchedByAgentId: null,
        launchedByUserId: null,
        completedByAgentId: null,
        completedByUserId: null,
        launchedAt: nowIso,
        completedAt: null,
        archivedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const updatedExecutions = [
      initialExecutions[0],
      {
        ...initialExecutions[1],
        status: "active",
        completionNotes: null,
        updatedAt: nowIso,
      },
    ];

    const initialOperatorSummary = {
      projectId: project.id,
      openQuestionCount: 3,
      blockingQuestionCount: 1,
      pendingGateCount: 1,
      blockedGateCount: 1,
      approvedGateCount: 0,
      pendingReviewCount: 1,
      activeExecutionCount: 1,
      failedExecutionCount: 1,
      recoveryIssueCount: 1,
      resumableExecutionCount: 1,
      orphanWorkspaceCount: 0,
      recovery: initialRecovery,
    };

    const dagArtifact = {
      id: "artifact-project-json",
      companyId: company.id,
      projectId: project.id,
      key: "project-json",
      kind: "dag_manifest",
      required: true,
      sourcePath: "generated/project.json",
      description: "Generated Critical DAG manifest for the project factory.",
      title: "Compiled project.json",
      format: "json",
      latestRevisionId: "revision-1",
      latestRevisionNumber: 1,
      createdByAgentId: null,
      createdByUserId: "user-1",
      updatedByAgentId: null,
      updatedByUserId: "user-1",
      createdAt: nowIso,
      updatedAt: nowIso,
      body: JSON.stringify({
        id: project.id,
        name: project.name,
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
      }),
    };

    const updatedOperatorSummary = {
      ...initialOperatorSummary,
      activeExecutionCount: 2,
      failedExecutionCount: 0,
      recoveryIssueCount: 0,
      resumableExecutionCount: 0,
      recovery: updatedRecovery,
    };

    await page.route(`**/api/projects/${project.id}/factory/operator-summary**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(resumed ? updatedOperatorSummary : initialOperatorSummary),
      });
    });

    await page.route(`**/api/projects/${project.id}/factory/review-state**`, async (route) => {
      const reviewState = buildReviewState(nowIso);
      reviewState.projectId = project.id;
      reviewState.gates[0].latestEvaluation.projectId = project.id;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(reviewState),
      });
    });

    await page.route(`**/api/projects/${project.id}/factory/recovery**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(resumed ? updatedRecovery : initialRecovery),
      });
    });

    await page.route(`**/api/projects/${project.id}/factory/executions**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(resumed ? updatedExecutions : initialExecutions),
      });
    });

    await page.route(`**/api/projects/${project.id}/factory/executions/execution-failed/resume**`, async (route) => {
      resumed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          execution: updatedExecutions[1],
          executionWorkspace: null,
          executionManifestKey: "execution-manifest",
        }),
      });
    });

    await page.goto(`/${company.issuePrefix}/projects/${projectRef}/factory`);

    await expect(page.getByText("Factory control panel")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Architecture review")).toBeVisible();
    await expect(page.getByText("Execution can be resumed from its surviving workspace.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

    await page.getByRole("button", { name: "Resume" }).click();

    await expect(page.getByText("No current recovery blockers.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("No recovery work is pending.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(0);
    } finally {
      if (companyId) {
        await page.request.delete(`/api/companies/${companyId}`).catch(() => {});
      }
    }
  });
});
