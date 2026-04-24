import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProjectService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  updateWorkspace: vi.fn(),
  removeWorkspace: vi.fn(),
  remove: vi.fn(),
  resolveByReference: vi.fn(),
}));
const mockProjectFactoryService = vi.hoisted(() => ({
  getIntakeSummary: vi.fn(),
  listProjectArtifacts: vi.fn(),
  upsertProjectArtifact: vi.fn(),
  listQuestions: vi.fn(),
  createQuestion: vi.fn(),
  answerQuestion: vi.fn(),
  listDecisions: vi.fn(),
  compileProject: vi.fn(),
  listTaskExecutions: vi.fn(),
  launchTaskExecution: vi.fn(),
  markTaskExecutionCompleted: vi.fn(),
  archiveTaskExecution: vi.fn(),
  listExecutionReviews: vi.fn(),
  recordExecutionReview: vi.fn(),
  listGateEvaluations: vi.fn(),
  recordGateEvaluation: vi.fn(),
  getReviewState: vi.fn(),
}));
const mockSecretService = vi.hoisted(() => ({
  normalizeEnvBindingsForPersistence: vi.fn(),
}));
const mockEnvironmentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));
const mockWorkspaceOperationService = vi.hoisted(() => ({}));
const mockLogActivity = vi.hoisted(() => vi.fn());
const mockGetTelemetryClient = vi.hoisted(() => vi.fn());

vi.mock("../telemetry.js", () => ({
  getTelemetryClient: mockGetTelemetryClient,
}));

vi.mock("../services/index.js", () => ({
  environmentService: () => mockEnvironmentService,
  logActivity: mockLogActivity,
  projectService: () => mockProjectService,
  projectFactoryService: () => mockProjectFactoryService,
  secretService: () => mockSecretService,
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

vi.mock("../services/workspace-runtime.js", () => ({
  startRuntimeServicesForWorkspaceControl: vi.fn(),
  stopRuntimeServicesForProjectWorkspace: vi.fn(),
}));

function registerModuleMocks() {
  vi.doMock("../telemetry.js", () => ({
    getTelemetryClient: mockGetTelemetryClient,
  }));

  vi.doMock("../services/index.js", () => ({
    environmentService: () => mockEnvironmentService,
    logActivity: mockLogActivity,
    projectService: () => mockProjectService,
    projectFactoryService: () => mockProjectFactoryService,
    secretService: () => mockSecretService,
    workspaceOperationService: () => mockWorkspaceOperationService,
  }));

  vi.doMock("../services/workspace-runtime.js", () => ({
    startRuntimeServicesForWorkspaceControl: vi.fn(),
    stopRuntimeServicesForProjectWorkspace: vi.fn(),
  }));
}

async function createApp() {
  const [{ projectRoutes }, { errorHandler }] = await Promise.all([
    vi.importActual<typeof import("../routes/projects.js")>("../routes/projects.js"),
    vi.importActual<typeof import("../middleware/index.js")>("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "board-user",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", projectRoutes({} as any));
  app.use(errorHandler);
  return app;
}

function buildProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    companyId: "company-1",
    urlKey: "project-1",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Project",
    description: null,
    status: "backlog",
    leadAgentId: null,
    targetDate: null,
    color: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/project",
      effectiveLocalFolder: "/tmp/project",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("project factory routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../routes/projects.js");
    vi.doUnmock("../routes/authz.js");
    vi.doUnmock("../middleware/index.js");
    registerModuleMocks();
    vi.resetAllMocks();
    mockGetTelemetryClient.mockReturnValue({ track: vi.fn() });
    mockProjectService.resolveByReference.mockResolvedValue({ ambiguous: false, project: null });
    mockProjectService.createWorkspace.mockResolvedValue(null);
    mockProjectService.listWorkspaces.mockResolvedValue([]);
    mockProjectService.getById.mockResolvedValue(buildProject());
    mockSecretService.normalizeEnvBindingsForPersistence.mockImplementation(async (_companyId, env) => env);
  });

  it("returns the project factory intake summary", async () => {
    mockProjectFactoryService.getIntakeSummary.mockResolvedValue({
      projectId: "project-1",
      normalizedProjectRecord: {
        projectId: "project-1",
        projectName: "Project",
        artifactKeys: ["prd"],
        answeredQuestionCount: 1,
        openQuestionCount: 0,
        blockingQuestionCount: 0,
      },
      missingContextCandidates: [],
      artifacts: [],
      questions: [],
      decisions: [],
    });

    const app = await createApp();
    const res = await request(app).get("/api/projects/project-1/factory/intake");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.getIntakeSummary).toHaveBeenCalledWith("project-1");
  });

  it("upserts a project factory artifact and logs safe metadata", async () => {
    mockProjectFactoryService.upsertProjectArtifact.mockResolvedValue({
      created: true,
      artifact: {
        id: "artifact-1",
        companyId: "company-1",
        projectId: "project-1",
        key: "prd",
        kind: "prd",
        required: true,
        sourcePath: "doc/factory/PRD.md",
        description: "Product requirements",
        title: "Factory PRD",
        format: "markdown",
        body: "# PRD",
        latestRevisionId: "revision-1",
        latestRevisionNumber: 1,
        createdByAgentId: null,
        createdByUserId: "board-user",
        updatedByAgentId: null,
        updatedByUserId: "board-user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const app = await createApp();
    const res = await request(app)
      .put("/api/projects/project-1/factory/artifacts/prd")
      .send({
        kind: "prd",
        title: "Factory PRD",
        format: "markdown",
        body: "# PRD",
        required: true,
        description: "Product requirements",
        sourcePath: "doc/factory/PRD.md",
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockProjectFactoryService.upsertProjectArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        key: "prd",
        kind: "prd",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({
          key: "prd",
          kind: "prd",
          sourcePath: "doc/factory/PRD.md",
        }),
      }),
    );
  });

  it("compiles project factory state into a manifest and generated task specs", async () => {
    mockProjectFactoryService.compileProject.mockResolvedValue({
      manifest: {
        id: "project-1-factory",
        name: "Project",
        version: "0.1.0",
        status: "planning",
        risk: "high",
        methodology: "ccpm-dag",
        description: "Compiled factory manifest",
        phases: [],
        artifacts: [],
        questions: [],
        decisions: [],
        gates: [],
        chain: { totalTasks: 8, completedTasks: 0, tasks: [] },
      },
      generatedArtifactKeys: ["project-json", "task-specs-readme", "task-spec-fs-00"],
      generatedTaskSpecKeys: ["task-spec-fs-00"],
    });

    const app = await createApp();
    const res = await request(app).post("/api/projects/project-1/factory/compile").send({});

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.compileProject).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ createdByUserId: "board-user" }),
    );
  });

  it("launches a project factory task execution and logs workspace metadata", async () => {
    mockProjectFactoryService.launchTaskExecution.mockResolvedValue({
      execution: {
        id: "execution-1",
        companyId: "company-1",
        projectId: "project-1",
        taskId: "FS-05",
        taskName: "Execution substrate and worktree manager",
        taskSpecArtifactKey: "task-spec-fs-05",
        status: "active",
        executionWorkspaceId: "workspace-1",
        projectWorkspaceId: "workspace-primary",
        workspaceMode: "isolated_workspace",
        workspaceStrategyType: "git_worktree",
        workspaceProviderType: "git_worktree",
        workspaceName: "FS-05 workspace",
        branchName: "factory/project-1/FS-05",
        worktreePath: "/tmp/factory/project-1/FS-05",
        completionMarker: "TASK_COMPLETED::FS-05",
        completionNotes: null,
        metadata: null,
        launchedByAgentId: null,
        launchedByUserId: "board-user",
        completedByAgentId: null,
        completedByUserId: null,
        launchedAt: new Date(),
        completedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      executionWorkspace: {
        id: "workspace-1",
        companyId: "company-1",
        projectId: "project-1",
        projectWorkspaceId: "workspace-primary",
        sourceIssueId: null,
        mode: "isolated_workspace",
        strategyType: "git_worktree",
        name: "FS-05 workspace",
        status: "active",
        cwd: "/tmp/factory/project-1/FS-05",
        repoUrl: null,
        baseRef: "main",
        branchName: "factory/project-1/FS-05",
        providerType: "git_worktree",
        providerRef: "/tmp/factory/project-1/FS-05",
        derivedFromExecutionWorkspaceId: null,
        lastUsedAt: new Date(),
        openedAt: new Date(),
        closedAt: null,
        cleanupEligibleAt: null,
        cleanupReason: null,
        config: null,
        metadata: null,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      executionManifestKey: "execution-manifest",
    });

    const app = await createApp();
    const res = await request(app)
      .post("/api/projects/project-1/factory/executions")
      .send({ taskId: "FS-05" });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockProjectFactoryService.launchTaskExecution).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ taskId: "FS-05", launchedByUserId: "board-user" }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "project.factory_execution_launched",
        details: expect.objectContaining({
          executionId: "execution-1",
          taskId: "FS-05",
          executionWorkspaceId: "workspace-1",
          branchName: "factory/project-1/FS-05",
        }),
      }),
    );
  });

  it("lists project factory task executions", async () => {
    mockProjectFactoryService.listTaskExecutions.mockResolvedValue([
      {
        id: "execution-1",
        companyId: "company-1",
        projectId: "project-1",
        taskId: "FS-05",
        taskName: "Execution substrate and worktree manager",
        taskSpecArtifactKey: "task-spec-fs-05",
        status: "active",
        executionWorkspaceId: "workspace-1",
        projectWorkspaceId: "workspace-primary",
        workspaceMode: "isolated_workspace",
        workspaceStrategyType: "git_worktree",
        workspaceProviderType: "git_worktree",
        workspaceName: "FS-05 workspace",
        branchName: "factory/project-1/FS-05",
        worktreePath: "/tmp/factory/project-1/FS-05",
        completionMarker: "TASK_COMPLETED::FS-05",
        completionNotes: null,
        metadata: null,
        launchedByAgentId: null,
        launchedByUserId: "board-user",
        completedByAgentId: null,
        completedByUserId: null,
        launchedAt: new Date(),
        completedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const app = await createApp();
    const res = await request(app).get("/api/projects/project-1/factory/executions");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.listTaskExecutions).toHaveBeenCalledWith("project-1");
  });

  it("marks a project factory task execution complete and logs the completion marker", async () => {
    mockProjectFactoryService.markTaskExecutionCompleted.mockResolvedValue({
      execution: {
        id: "execution-1",
        companyId: "company-1",
        projectId: "project-1",
        taskId: "FS-05",
        taskName: "Execution substrate and worktree manager",
        taskSpecArtifactKey: "task-spec-fs-05",
        status: "completed",
        executionWorkspaceId: "workspace-1",
        projectWorkspaceId: "workspace-primary",
        workspaceMode: "isolated_workspace",
        workspaceStrategyType: "git_worktree",
        workspaceProviderType: "git_worktree",
        workspaceName: "FS-05 workspace",
        branchName: "factory/project-1/FS-05",
        worktreePath: "/tmp/factory/project-1/FS-05",
        completionMarker: "TASK_COMPLETED::FS-05",
        completionNotes: "Ready for review",
        metadata: null,
        launchedByAgentId: null,
        launchedByUserId: "board-user",
        completedByAgentId: null,
        completedByUserId: "board-user",
        launchedAt: new Date(),
        completedAt: new Date(),
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      executionWorkspace: {
        id: "workspace-1",
        companyId: "company-1",
        projectId: "project-1",
        projectWorkspaceId: "workspace-primary",
        sourceIssueId: null,
        mode: "isolated_workspace",
        strategyType: "git_worktree",
        name: "FS-05 workspace",
        status: "in_review",
        cwd: "/tmp/factory/project-1/FS-05",
        repoUrl: null,
        baseRef: "main",
        branchName: "factory/project-1/FS-05",
        providerType: "git_worktree",
        providerRef: "/tmp/factory/project-1/FS-05",
        derivedFromExecutionWorkspaceId: null,
        lastUsedAt: new Date(),
        openedAt: new Date(),
        closedAt: null,
        cleanupEligibleAt: null,
        cleanupReason: null,
        config: null,
        metadata: null,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      executionManifestKey: "execution-manifest",
    });

    const app = await createApp();
    const res = await request(app)
      .post("/api/projects/project-1/factory/executions/execution-1/complete")
      .send({ completionMarker: "TASK_COMPLETED::FS-05", notes: "Ready for review" });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.markTaskExecutionCompleted).toHaveBeenCalledWith(
      "project-1",
      "execution-1",
      expect.objectContaining({
        completionMarker: "TASK_COMPLETED::FS-05",
        notes: "Ready for review",
        completedByUserId: "board-user",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "project.factory_execution_completed",
        details: expect.objectContaining({
          executionId: "execution-1",
          completionMarker: "TASK_COMPLETED::FS-05",
        }),
      }),
    );
  });

  it("archives a project factory task execution and logs cleanup metadata", async () => {
    mockProjectFactoryService.archiveTaskExecution.mockResolvedValue({
      execution: {
        id: "execution-1",
        companyId: "company-1",
        projectId: "project-1",
        taskId: "FS-05",
        taskName: "Execution substrate and worktree manager",
        taskSpecArtifactKey: "task-spec-fs-05",
        status: "archived",
        executionWorkspaceId: "workspace-1",
        projectWorkspaceId: "workspace-primary",
        workspaceMode: "isolated_workspace",
        workspaceStrategyType: "git_worktree",
        workspaceProviderType: "git_worktree",
        workspaceName: "FS-05 workspace",
        branchName: "factory/project-1/FS-05",
        worktreePath: "/tmp/factory/project-1/FS-05",
        completionMarker: "TASK_COMPLETED::FS-05",
        completionNotes: "Ready for review",
        metadata: null,
        launchedByAgentId: null,
        launchedByUserId: "board-user",
        completedByAgentId: null,
        completedByUserId: "board-user",
        launchedAt: new Date(),
        completedAt: new Date(),
        archivedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      executionWorkspace: {
        id: "workspace-1",
        companyId: "company-1",
        projectId: "project-1",
        projectWorkspaceId: "workspace-primary",
        sourceIssueId: null,
        mode: "isolated_workspace",
        strategyType: "git_worktree",
        name: "FS-05 workspace",
        status: "archived",
        cwd: "/tmp/factory/project-1/FS-05",
        repoUrl: null,
        baseRef: "main",
        branchName: "factory/project-1/FS-05",
        providerType: "git_worktree",
        providerRef: "/tmp/factory/project-1/FS-05",
        derivedFromExecutionWorkspaceId: null,
        lastUsedAt: new Date(),
        openedAt: new Date(),
        closedAt: new Date(),
        cleanupEligibleAt: null,
        cleanupReason: null,
        config: null,
        metadata: null,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      cleanup: {
        cleanedPath: "/tmp/factory/project-1/FS-05",
        cleaned: true,
        warnings: [],
      },
      executionManifestKey: "execution-manifest",
    });

    const app = await createApp();
    const res = await request(app)
      .post("/api/projects/project-1/factory/executions/execution-1/archive")
      .send({ notes: "Archive after review" });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.archiveTaskExecution).toHaveBeenCalledWith(
      "project-1",
      "execution-1",
      expect.objectContaining({ archivedByUserId: "board-user" }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "project.factory_execution_archived",
        details: expect.objectContaining({
          executionId: "execution-1",
          cleaned: true,
          cleanedPath: "/tmp/factory/project-1/FS-05",
        }),
      }),
    );
  });

  it("returns the project factory review state", async () => {
    mockProjectFactoryService.getReviewState.mockResolvedValue({
      projectId: "project-1",
      gates: [
        {
          gateId: "G1",
          phaseId: "P2",
          title: "Clarification + compilation ready",
          blocking: true,
          defaultStatus: "ready",
          effectiveStatus: "approved",
          latestEvaluation: { id: "gate-eval-1", status: "approved" },
        },
      ],
      evaluations: [],
      executionReviewSummaries: [
        {
          executionId: "execution-1",
          taskId: "FS-05",
          reviewCount: 1,
          latestVerdict: "approved",
        },
      ],
    });

    const app = await createApp();
    const res = await request(app).get("/api/projects/project-1/factory/review-state");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.getReviewState).toHaveBeenCalledWith("project-1");
  });

  it("records a project factory execution review and logs the verdict", async () => {
    const now = new Date();
    mockProjectFactoryService.recordExecutionReview.mockResolvedValue({
      id: "review-1",
      companyId: "company-1",
      projectId: "project-1",
      executionId: "execution-1",
      taskId: "FS-05",
      verdict: "approved",
      summary: "Worktree lifecycle verified.",
      decidedByAgentId: null,
      decidedByUserId: "board-user",
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const app = await createApp();
    const res = await request(app)
      .post("/api/projects/project-1/factory/executions/execution-1/reviews")
      .send({ verdict: "approved", summary: "Worktree lifecycle verified." });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockProjectFactoryService.recordExecutionReview).toHaveBeenCalledWith(
      "project-1",
      "execution-1",
      expect.objectContaining({
        verdict: "approved",
        summary: "Worktree lifecycle verified.",
        decidedByUserId: "board-user",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "project.factory_execution_reviewed",
        details: expect.objectContaining({
          executionId: "execution-1",
          reviewId: "review-1",
          verdict: "approved",
        }),
      }),
    );
  });

  it("lists project factory execution reviews", async () => {
    mockProjectFactoryService.listExecutionReviews.mockResolvedValue([]);

    const app = await createApp();
    const res = await request(app).get("/api/projects/project-1/factory/reviews");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.listExecutionReviews).toHaveBeenCalledWith("project-1");
  });

  it("records a project factory gate evaluation and logs the verdict", async () => {
    const now = new Date();
    mockProjectFactoryService.recordGateEvaluation.mockResolvedValue({
      id: "gate-eval-1",
      companyId: "company-1",
      projectId: "project-1",
      gateId: "G1",
      phaseId: "P2",
      status: "approved",
      summary: "Decisions resolved.",
      decidedByAgentId: null,
      decidedByUserId: "board-user",
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const app = await createApp();
    const res = await request(app)
      .post("/api/projects/project-1/factory/gate-evaluations")
      .send({ gateId: "G1", status: "approved", summary: "Decisions resolved." });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockProjectFactoryService.recordGateEvaluation).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        gateId: "G1",
        status: "approved",
        summary: "Decisions resolved.",
        decidedByUserId: "board-user",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "project.factory_gate_evaluated",
        details: expect.objectContaining({
          gateId: "G1",
          status: "approved",
          evaluationId: "gate-eval-1",
        }),
      }),
    );
  });

  it("lists project factory gate evaluations", async () => {
    mockProjectFactoryService.listGateEvaluations.mockResolvedValue([]);

    const app = await createApp();
    const res = await request(app).get("/api/projects/project-1/factory/gate-evaluations");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockProjectFactoryService.listGateEvaluations).toHaveBeenCalledWith("project-1");
  });
});
