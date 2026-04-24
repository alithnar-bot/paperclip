import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  createDb,
  documentRevisions,
  documents,
  executionWorkspaces,
  projectFactoryDecisions,
  projectFactoryQuestions,
  projectDocuments,
  projectWorkspaces,
  projects,
  workspaceOperations,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { executionWorkspaceService } from "../services/execution-workspaces.js";
import { projectFactoryService } from "../services/project-factory.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres project factory tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function createTempGitRepo(prefix: string) {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: repoDir, stdio: "pipe" });
  } catch {
    execFileSync("git", ["init"], { cwd: repoDir, stdio: "pipe" });
    try {
      execFileSync("git", ["checkout", "-b", "main"], { cwd: repoDir, stdio: "pipe" });
    } catch {
      // Minor indignity: some git builds already default to main.
    }
  }
  execFileSync("git", ["config", "user.email", "factory-tests@example.com"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "Factory Tests"], { cwd: repoDir, stdio: "pipe" });
  await fs.writeFile(path.join(repoDir, "README.md"), "# factory test repo\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "pipe" });
  return repoDir;
}

describeEmbeddedPostgres("projectFactoryService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof projectFactoryService>;
  let workspacesSvc!: ReturnType<typeof executionWorkspaceService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-project-factory-");
    db = createDb(tempDb.connectionString);
    svc = projectFactoryService(db);
    workspacesSvc = executionWorkspaceService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(projectFactoryDecisions);
    await db.delete(projectFactoryQuestions);
    await db.delete(projectDocuments);
    await db.delete(workspaceOperations);
    await db.delete(executionWorkspaces);
    await db.delete(projectWorkspaces);
    await db.delete(documentRevisions);
    await db.delete(documents);
    await db.delete(projects);
    await db.delete(companies);
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("persists project artifacts, answers blocking questions as decisions, and produces an intake summary", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Software Factory",
      status: "planned",
    });

    const artifactResult = await svc.upsertProjectArtifact({
      projectId,
      key: "prd",
      kind: "prd",
      title: "Factory PRD",
      format: "markdown",
      body: "# Factory PRD",
      required: true,
      description: "Product requirements for the software factory.",
      sourcePath: "doc/factory/PRD.md",
      createdByUserId: "local-board",
    });
    const artifact = artifactResult.artifact;

    expect(artifact.key).toBe("prd");
    expect(artifact.kind).toBe("prd");
    expect(artifact.sourcePath).toBe("doc/factory/PRD.md");

    const question = await svc.createQuestion(projectId, {
      text: "Should the first persistence slice use project documents as the artifact registry?",
      helpText: "This decides whether Phase 1 starts by extending the existing documents surface.",
      blocking: true,
      createdByUserId: "local-board",
    });

    const answered = await svc.answerQuestion(projectId, question.id, {
      answer: "Yes. Use project documents first, then grow dedicated artifact tables only if necessary.",
      decision: {
        title: "Use project documents as the initial artifact registry",
        summary: "Phase 1 persists PRDs and related planning assets through project-linked documents before introducing dedicated artifact storage.",
        type: "architecture",
        decidedBy: "operator",
      },
      answeredByUserId: "local-board",
    });

    expect(answered.question.status).toBe("answered");
    expect(answered.question.decisionRef).toBe(answered.decision.id);
    expect(answered.decision.type).toBe("architecture");

    const summary = await svc.getIntakeSummary(projectId);
    expect(summary.projectId).toBe(projectId);
    expect(summary.artifacts.map((item) => item.key)).toEqual(["prd"]);
    expect(summary.questions).toHaveLength(1);
    expect(summary.decisions).toHaveLength(1);
    expect(summary.normalizedProjectRecord.projectName).toBe("Software Factory");
    expect(summary.normalizedProjectRecord.artifactKeys).toEqual(["prd"]);
    expect(summary.missingContextCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "artifact", key: "tech-spec" }),
        expect.objectContaining({ kind: "artifact", key: "architecture" }),
      ]),
    );
  });

  it("compiles clarified factory state into a generated manifest and task-spec bundle", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Software Factory",
      status: "planned",
    });

    const seedArtifacts = [
      ["prd", "prd", "Factory PRD"],
      ["tech-spec", "tech_spec", "Factory Tech Spec"],
      ["architecture", "architecture", "Factory Architecture"],
      ["decisions", "decisions", "Factory Decisions"],
      ["implementation-plan", "implementation_plan", "Factory Implementation Plan"],
      ["task-spec-bundle", "task_spec_bundle", "Factory Task Pack"],
    ] as const;

    for (const [key, kind, title] of seedArtifacts) {
      await svc.upsertProjectArtifact({
        projectId,
        key,
        kind,
        title,
        format: "markdown",
        body: `# ${title}`,
        required: true,
        sourcePath: `doc/factory/${title.replace(/ /g, "-")}.md`,
        createdByUserId: "local-board",
      });
    }

    const question = await svc.createQuestion(projectId, {
      text: "Which execution substrate should Phase 3 use?",
      blocking: true,
      createdByUserId: "local-board",
    });

    await svc.answerQuestion(projectId, question.id, {
      answer: "Use isolated git worktrees rooted in the project primary workspace.",
      decision: {
        title: "Use git worktrees for Phase 3 task execution",
        summary: "Task execution should provision isolated git worktrees from the primary project workspace.",
        type: "execution",
        decidedBy: "operator",
      },
      answeredByUserId: "local-board",
    });

    const compiled = await svc.compileProject(projectId, {
      createdByUserId: "local-board",
    });

    expect(compiled.manifest.chain.totalTasks).toBe(8);
    expect(compiled.generatedArtifactKeys).toEqual(
      expect.arrayContaining(["project-json", "task-specs-readme", "task-spec-fs-05"]),
    );
    expect(compiled.generatedTaskSpecKeys).toContain("task-spec-fs-05");

    const manifestArtifact = await svc.getProjectArtifactByKey(projectId, "project-json");
    expect(manifestArtifact?.format).toBe("json");
    expect(JSON.parse(manifestArtifact?.body ?? "{}")).toMatchObject({
      chain: {
        totalTasks: 8,
      },
    });

    const taskSpecArtifact = await svc.getProjectArtifactByKey(projectId, "task-spec-fs-05");
    expect(taskSpecArtifact?.body).toContain("# FS-05 — Execution substrate and worktree manager");
  });

  it("launches, completes, and archives a factory task execution with a git worktree and execution manifest", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const repoDir = await createTempGitRepo("paperclip-project-factory-repo-");
    tempDirs.push(repoDir);

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Software Factory",
      status: "planned",
    });

    const [primaryWorkspace] = await db
      .insert(projectWorkspaces)
      .values({
        companyId,
        projectId,
        name: "Primary repo",
        sourceType: "local_path",
        cwd: repoDir,
        repoRef: "main",
        defaultRef: "main",
        isPrimary: true,
      })
      .returning();

    const seedArtifacts = [
      ["prd", "prd", "Factory PRD"],
      ["tech-spec", "tech_spec", "Factory Tech Spec"],
      ["architecture", "architecture", "Factory Architecture"],
      ["decisions", "decisions", "Factory Decisions"],
      ["implementation-plan", "implementation_plan", "Factory Implementation Plan"],
      ["task-spec-bundle", "task_spec_bundle", "Factory Task Pack"],
    ] as const;

    for (const [key, kind, title] of seedArtifacts) {
      await svc.upsertProjectArtifact({
        projectId,
        key,
        kind,
        title,
        format: "markdown",
        body: `# ${title}`,
        required: true,
        sourcePath: `doc/factory/${title.replace(/ /g, "-")}.md`,
        createdByUserId: "local-board",
      });
    }

    const question = await svc.createQuestion(projectId, {
      text: "Which execution substrate should Phase 3 use?",
      blocking: true,
      createdByUserId: "local-board",
    });

    await svc.answerQuestion(projectId, question.id, {
      answer: "Use isolated git worktrees rooted in the project primary workspace.",
      decision: {
        title: "Use git worktrees for Phase 3 task execution",
        summary: "Task execution should provision isolated git worktrees from the primary project workspace.",
        type: "execution",
        decidedBy: "operator",
      },
      answeredByUserId: "local-board",
    });

    await svc.compileProject(projectId, {
      createdByUserId: "local-board",
    });

    const launched = await svc.launchTaskExecution(projectId, {
      taskId: "FS-05",
      launchedByUserId: "local-board",
    });

    expect(launched.execution.taskId).toBe("FS-05");
    expect(launched.execution.status).toBe("active");
    expect(launched.execution.executionWorkspaceId).toBeTruthy();
    expect(launched.execution.workspaceMode).toBe("isolated_workspace");
    expect(launched.execution.workspaceStrategyType).toBe("git_worktree");
    expect(launched.execution.branchName).toContain("FS-05");
    expect(launched.execution.worktreePath).toBeTruthy();
    await expect(fs.access(launched.execution.worktreePath!)).resolves.toBeUndefined();

    const launchPackDir = path.join(
      launched.execution.worktreePath!,
      ".paperclip",
      "factory",
      "executions",
      launched.execution.id,
    );
    const taskSpecMarkdown = await fs.readFile(path.join(launchPackDir, "TASK.md"), "utf8");
    expect(taskSpecMarkdown).toContain("# FS-05 — Execution substrate and worktree manager");

    const listed = await svc.listTaskExecutions(projectId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(launched.execution.id);

    const executionManifestArtifact = await svc.getProjectArtifactByKey(projectId, "execution-manifest");
    expect(executionManifestArtifact?.format).toBe("json");
    expect(JSON.parse(executionManifestArtifact?.body ?? "{}")).toMatchObject({
      summary: { activeExecutionCount: 1 },
      executions: [
        expect.objectContaining({
          taskId: "FS-05",
          status: "active",
        }),
      ],
    });

    const completed = await svc.markTaskExecutionCompleted(projectId, launched.execution.id, {
      completionMarker: launched.execution.completionMarker,
      notes: "Worktree provisioned and launch pack written.",
      completedByUserId: "local-board",
    });

    expect(completed.execution.status).toBe("completed");
    expect(completed.execution.completedAt).toBeTruthy();
    const persistedWorkspace = await workspacesSvc.getById(launched.execution.executionWorkspaceId!);
    expect(persistedWorkspace?.status).toBe("in_review");

    const archived = await svc.archiveTaskExecution(projectId, launched.execution.id, {
      archivedByUserId: "local-board",
    });

    expect(archived.execution.status).toBe("archived");
    expect(archived.cleanup?.cleaned).toBe(true);
    await expect(fs.access(launched.execution.worktreePath!)).rejects.toThrow();

    const finalManifestArtifact = await svc.getProjectArtifactByKey(projectId, "execution-manifest");
    expect(JSON.parse(finalManifestArtifact?.body ?? "{}")).toMatchObject({
      summary: { archivedExecutionCount: 1 },
      executions: [
        expect.objectContaining({
          taskId: "FS-05",
          status: "archived",
        }),
      ],
    });

    const archivedWorkspace = await workspacesSvc.getById(launched.execution.executionWorkspaceId!);
    expect(archivedWorkspace?.status).toBe("archived");
    expect(archivedWorkspace?.closedAt).toBeTruthy();
    expect(primaryWorkspace.cwd).toBe(repoDir);
  });
});
