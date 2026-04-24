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
    const companyRes = await page.request.post("/api/companies", {
      data: { name: COMPANY_NAME },
    });
    expect(companyRes.ok()).toBe(true);
    const company = await companyRes.json();

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
  });
});
