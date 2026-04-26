import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  documentRevisions,
  documents,
  executionWorkspaces,
  issues,
  projectDocuments,
  projectFactoryDecisions,
  projectFactoryGateEvaluations,
  projectFactoryQuestions,
  projectFactoryReviews,
  projectFactoryTaskExecutions,
  projects,
  projectWorkspaces,
} from "@paperclipai/db";
import type {
  AnswerProjectFactoryQuestionResult,
  ExecutionWorkspace,
  FactoryGateState,
  FactoryProjectManifest,
  ProjectFactoryArchiveTaskExecutionResult,
  ProjectFactoryArtifact,
  ProjectFactoryArtifactSummary,
  ProjectFactoryCompileResult,
  ProjectFactoryCompleteTaskExecutionResult,
  ProjectFactoryDecision,
  ProjectFactoryExecutionCleanupResult,
  ProjectFactoryExecutionManifest,
  ProjectFactoryExecutionManifestExecution,
  ProjectFactoryExecutionReview,
  ProjectFactoryExecutionReviewSummary,
  ProjectFactoryGateEvaluation,
  ProjectFactoryGateEvaluationStatus,
  ProjectFactoryGateState,
  ProjectFactoryIntakeSummary,
  ProjectFactoryLaunchTaskExecutionResult,
  ProjectFactoryMissingContextCandidate,
  ProjectFactoryOperatorSummary,
  ProjectFactoryQuestion,
  ProjectFactoryRecoveryIssue,
  ProjectFactoryRecoverySummary,
  ProjectFactoryResumeTaskExecutionResult,
  ProjectFactoryReviewState,
  ProjectFactoryReviewVerdict,
  ProjectFactoryTaskExecution,
} from "@paperclipai/shared";
import {
  factoryDecisionStatusSchema,
  factoryGateStatusSchema,
  factoryProjectManifestSchema,
  projectFactoryArtifactKeySchema,
  projectFactoryDecisionActorSchema,
  projectFactoryDecisionTypeSchema,
  projectFactoryGateEvaluationStatusSchema,
  projectFactoryGateIdSchema,
  projectFactoryQuestionStatusSchema,
  projectFactoryReviewVerdictSchema,
  projectFactoryTaskExecutionStatusSchema,
  projectFactoryTaskIdSchema,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { issueService } from "./issues.js";
import { heartbeatService } from "./heartbeat.js";
import { executionWorkspaceService } from "./execution-workspaces.js";
import { queueIssueAssignmentWakeup, type IssueAssignmentWakeupDeps } from "./issue-assignment-wakeup.js";
import { parseProjectExecutionWorkspacePolicy } from "./execution-workspace-policy.js";
import { workspaceOperationService } from "./workspace-operations.js";
import { cleanupExecutionWorkspaceArtifacts, realizeExecutionWorkspace } from "./workspace-runtime.js";

const REQUIRED_FACTORY_ARTIFACT_KEYS = [
  "prd",
  "tech-spec",
  "architecture",
  "decisions",
  "implementation-plan",
  "task-spec-bundle",
] as const;

const DEFAULT_FACTORY_PHASES: FactoryProjectManifest["phases"] = [
  { id: "P0", name: "Interface Lock", description: "Lock the planning contract, manifest, and task pack." },
  { id: "P1", name: "Intake + Decisions", description: "Register artifacts, surface questions, and persist decisions." },
  { id: "P2", name: "Compilation", description: "Generate the Critical DAG and task specs from clarified inputs." },
  { id: "P3", name: "Execution Substrate", description: "Provision worktrees, launch tasks, and record execution state." },
  { id: "P4", name: "Review + Gates", description: "Evaluate gate readiness, review outputs, and block unsafe progression." },
  { id: "P5", name: "Recovery + Operator View", description: "Resume interrupted work and expose clear operator summaries." },
];

const DEFAULT_FACTORY_GATES: FactoryProjectManifest["gates"] = [
  {
    id: "G0",
    title: "Interface lock complete",
    phaseId: "P0",
    status: "approved",
    criteria: [
      "Factory pack exists under doc/factory/",
      "Shared manifest contract validates the committed sample",
      "Task pack exists for FS-00 through FS-07",
    ],
    blocking: true,
    dependsOn: [],
  },
  {
    id: "G1",
    title: "Clarification + compilation ready",
    phaseId: "P2",
    status: "ready",
    criteria: [
      "Questions can be persisted",
      "Decisions can be persisted and superseded",
      "DAG compiler emits a valid manifest",
      "Task specs are generated from clarified inputs",
      "Architecture approval blocks downstream execution",
    ],
    blocking: true,
    dependsOn: ["G0"],
  },
  {
    id: "G2",
    title: "Execution substrate ready",
    phaseId: "P4",
    status: "pending",
    criteria: [
      "Worktree lifecycle works end-to-end",
      "Execution manifest updates during runs",
      "Gate failures block progression",
    ],
    blocking: true,
    dependsOn: ["G1"],
  },
  {
    id: "G3",
    title: "Recovery slice ready",
    phaseId: "P5",
    status: "pending",
    criteria: [
      "Interrupted runs can be resumed safely",
      "Operator can see open questions and pending gates",
      "PRD-to-task-pack bootstrap works end-to-end",
    ],
    blocking: true,
    dependsOn: ["G2"],
  },
];

const DEFAULT_FACTORY_TASKS: FactoryProjectManifest["chain"]["tasks"] = [
  {
    id: "FS-00",
    name: "Interface lock, architecture, and contract pack",
    phaseId: "P0",
    wave: 0,
    status: "todo",
    estimateMin: 90,
    dependsOn: [],
    onCriticalPath: true,
    acceptance: [
      "Factory pack exists",
      "Manifest contract is locked",
      "Task pack exists for all planned slices",
    ],
  },
  {
    id: "FS-01",
    name: "Project artifact registry and intake normalization",
    phaseId: "P1",
    wave: 1,
    status: "todo",
    estimateMin: 120,
    dependsOn: ["FS-00"],
    onCriticalPath: true,
    acceptance: [
      "Factory artifacts can be attached to a project",
      "Intake emits a normalized project record",
      "Missing-context candidates are surfaced",
    ],
  },
  {
    id: "FS-02",
    name: "Question queue and decision log",
    phaseId: "P1",
    wave: 1,
    status: "todo",
    estimateMin: 120,
    dependsOn: ["FS-00"],
    onCriticalPath: true,
    acceptance: [
      "Blocking and non-blocking questions are modeled",
      "Answers persist into decisions",
      "Decision supersession is supported",
    ],
  },
  {
    id: "FS-03",
    name: "Critical DAG compiler and manifest generation",
    phaseId: "P2",
    wave: 2,
    status: "todo",
    estimateMin: 150,
    dependsOn: ["FS-01", "FS-02"],
    onCriticalPath: true,
    acceptance: [
      "Manifest is generated from clarified inputs",
      "Dependencies and waves are valid",
      "Critical-path flags are explicit",
    ],
  },
  {
    id: "FS-04",
    name: "Task-spec generator",
    phaseId: "P2",
    wave: 2,
    status: "todo",
    estimateMin: 120,
    dependsOn: ["FS-03"],
    onCriticalPath: false,
    acceptance: [
      "Task specs are rendered from the manifest",
      "Specs include acceptance and finalization discipline",
      "Spec output stays aligned with task metadata",
    ],
  },
  {
    id: "FS-05",
    name: "Execution substrate and worktree manager",
    phaseId: "P3",
    wave: 3,
    status: "todo",
    estimateMin: 180,
    dependsOn: ["FS-03"],
    onCriticalPath: true,
    acceptance: [
      "Worktrees can be provisioned safely",
      "Execution manifests are updated during runs",
      "Completion markers can be tracked",
    ],
  },
  {
    id: "FS-06",
    name: "Review and gate evaluator",
    phaseId: "P4",
    wave: 4,
    status: "todo",
    estimateMin: 150,
    dependsOn: ["FS-04", "FS-05"],
    onCriticalPath: true,
    acceptance: [
      "Gate criteria are evaluated explicitly",
      "Gate failures block progression",
      "Review verdicts persist cleanly",
    ],
  },
  {
    id: "FS-07",
    name: "Recovery and operator summary",
    phaseId: "P5",
    wave: 5,
    status: "todo",
    estimateMin: 150,
    dependsOn: ["FS-06"],
    onCriticalPath: true,
    acceptance: [
      "Interrupted runs can be resumed",
      "Operator can see open questions and pending gates",
      "End-to-end bootstrap works on a real project",
    ],
  },
];

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505";
}

function normalizeArtifactKey(key: string) {
  const normalized = key.trim().toLowerCase();
  const parsed = projectFactoryArtifactKeySchema.safeParse(normalized);
  if (!parsed.success) {
    throw unprocessable("Invalid project factory artifact key", parsed.error.issues);
  }
  return parsed.data;
}

const artifactSelect = {
  id: documents.id,
  companyId: documents.companyId,
  projectId: projectDocuments.projectId,
  key: projectDocuments.key,
  kind: projectDocuments.kind,
  required: projectDocuments.required,
  sourcePath: projectDocuments.sourcePath,
  description: projectDocuments.description,
  title: documents.title,
  format: documents.format,
  latestBody: documents.latestBody,
  latestRevisionId: documents.latestRevisionId,
  latestRevisionNumber: documents.latestRevisionNumber,
  createdByAgentId: documents.createdByAgentId,
  createdByUserId: documents.createdByUserId,
  updatedByAgentId: documents.updatedByAgentId,
  updatedByUserId: documents.updatedByUserId,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

function mapArtifactRow(row: any, includeBody: boolean): ProjectFactoryArtifact | ProjectFactoryArtifactSummary {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    key: row.key,
    kind: row.kind,
    required: row.required,
    sourcePath: row.sourcePath ?? null,
    description: row.description ?? null,
    title: row.title ?? null,
    format: row.format,
    ...(includeBody ? { body: row.latestBody } : {}),
    latestRevisionId: row.latestRevisionId ?? null,
    latestRevisionNumber: row.latestRevisionNumber,
    createdByAgentId: row.createdByAgentId ?? null,
    createdByUserId: row.createdByUserId ?? null,
    updatedByAgentId: row.updatedByAgentId ?? null,
    updatedByUserId: row.updatedByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDecisionRow(row: typeof projectFactoryDecisions.$inferSelect): ProjectFactoryDecision {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    questionId: row.questionId ?? null,
    title: row.title,
    summary: row.summary,
    type: projectFactoryDecisionTypeSchema.parse(row.type),
    status: factoryDecisionStatusSchema.parse(row.status),
    decidedBy: projectFactoryDecisionActorSchema.parse(row.decidedBy),
    decidedByAgentId: row.decidedByAgentId ?? null,
    decidedByUserId: row.decidedByUserId ?? null,
    supersedesDecisionId: row.supersedesDecisionId ?? null,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapQuestionRow(
  row: typeof projectFactoryQuestions.$inferSelect,
  decisionRef: string | null,
): ProjectFactoryQuestion {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    text: row.text,
    helpText: row.helpText ?? null,
    status: projectFactoryQuestionStatusSchema.parse(row.status),
    blocking: row.blocking,
    answer: row.answer ?? null,
    decisionRef,
    createdByAgentId: row.createdByAgentId ?? null,
    createdByUserId: row.createdByUserId ?? null,
    answeredAt: row.answeredAt ?? null,
    answeredByAgentId: row.answeredByAgentId ?? null,
    answeredByUserId: row.answeredByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function slugifyProjectName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project-factory";
}

function buildManifestFromProjectState(args: {
  projectId: string;
  projectName: string;
  artifacts: ProjectFactoryArtifactSummary[];
  questions: ProjectFactoryQuestion[];
  decisions: ProjectFactoryDecision[];
  blocked: boolean;
}): FactoryProjectManifest {
  return {
    id: `${slugifyProjectName(args.projectName)}-factory`,
    name: `${args.projectName} Factory`,
    version: "0.2.0-phase2",
    status: args.blocked ? "blocked" : "planning",
    risk: "high",
    methodology: "ccpm-dag",
    description: `Compiled factory manifest for ${args.projectName}.`,
    phases: DEFAULT_FACTORY_PHASES,
    artifacts: args.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title ?? artifact.key,
      path: artifact.sourcePath ?? `/projects/${args.projectId}/factory/artifacts/${artifact.key}`,
      required: artifact.required,
      description: artifact.description ?? null,
    })),
    questions: args.questions.map((question) => ({
      id: question.id,
      text: question.text,
      status: question.status,
      blocking: question.blocking,
      answer: question.answer,
      decisionRef: question.decisionRef,
    })),
    decisions: args.decisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      type: decision.type,
      status: decision.status,
      decidedBy: decision.decidedBy,
      decidedAt: decision.decidedAt.toISOString(),
    })),
    gates: DEFAULT_FACTORY_GATES.map((gate) => ({
      ...gate,
      status: gate.id === "G1" ? (args.blocked ? "blocked" : "ready") : gate.status,
    })),
    chain: {
      totalTasks: DEFAULT_FACTORY_TASKS.length,
      completedTasks: 0,
      tasks: DEFAULT_FACTORY_TASKS,
    },
  };
}

function rehydrateManifestFromProjectState(args: {
  projectId: string;
  artifacts: ProjectFactoryArtifactSummary[];
  questions: ProjectFactoryQuestion[];
  decisions: ProjectFactoryDecision[];
  blocked: boolean;
  seedManifest: FactoryProjectManifest;
}): FactoryProjectManifest {
  const seed = args.seedManifest;
  return {
    ...seed,
    status: args.blocked ? "blocked" : seed.status === "blocked" ? "planning" : seed.status,
    artifacts: args.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title ?? artifact.key,
      path: artifact.sourcePath ?? `/projects/${args.projectId}/factory/artifacts/${artifact.key}`,
      required: artifact.required,
      description: artifact.description ?? null,
    })),
    questions: args.questions.map((question) => ({
      id: question.id,
      text: question.text,
      status: question.status,
      blocking: question.blocking,
      answer: question.answer,
      decisionRef: question.decisionRef,
    })),
    decisions: args.decisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      type: decision.type,
      status: decision.status,
      decidedBy: decision.decidedBy,
      decidedAt: decision.decidedAt.toISOString(),
    })),
    chain: {
      totalTasks: seed.chain.tasks.length,
      completedTasks: seed.chain.tasks.filter((task) => task.status === "done").length,
      tasks: seed.chain.tasks,
    },
  };
}

function buildTaskSpecsReadmeMarkdown(manifest: FactoryProjectManifest) {
  const lines = [
    "# Generated Factory Task Specs",
    "",
    `Project: ${manifest.name}`,
    `Manifest ID: ${manifest.id}`,
    "",
    "## Task Set",
  ];
  for (const task of manifest.chain.tasks) {
    lines.push(`- \`${task.id}\` — ${task.name}`);
  }
  lines.push("", "## Rule", "Generated task specs are derived from the compiled factory manifest and current project decisions.");
  return lines.join("\n");
}

function buildTaskSpecMarkdown(args: {
  task: FactoryProjectManifest["chain"]["tasks"][number];
  manifest: FactoryProjectManifest;
  artifacts: ProjectFactoryArtifactSummary[];
  decisions: ProjectFactoryDecision[];
}) {
  const relevantArtifacts = args.artifacts.slice(0, 6);
  const relevantDecisions = args.decisions.slice(0, 6);
  const lines = [
    `# ${args.task.id} — ${args.task.name}`,
    "",
    `Phase: ${args.task.phaseId}`,
    `Wave: ${args.task.wave}`,
    `Critical path: ${args.task.onCriticalPath ? "yes" : "no"}`,
    `Estimate (min): ${args.task.estimateMin}`,
    "",
    "## Objective",
    `Advance ${args.manifest.name} through ${args.task.name.toLowerCase()}.`,
    "",
    "## Dependencies",
  ];

  if (args.task.dependsOn.length === 0) {
    lines.push("- None");
  } else {
    for (const dependency of args.task.dependsOn) {
      lines.push(`- ${dependency}`);
    }
  }

  lines.push("", "## Acceptance");
  for (const acceptance of args.task.acceptance) {
    lines.push(`- ${acceptance}`);
  }

  lines.push("", "## Relevant Artifacts");
  if (relevantArtifacts.length === 0) {
    lines.push("- None yet");
  } else {
    for (const artifact of relevantArtifacts) {
      lines.push(`- ${artifact.key} — ${artifact.title ?? artifact.key}`);
    }
  }

  lines.push("", "## Locked Decisions");
  if (relevantDecisions.length === 0) {
    lines.push("- None yet");
  } else {
    for (const decision of relevantDecisions) {
      lines.push(`- ${decision.id} — ${decision.title}`);
    }
  }

  lines.push(
    "",
    "## Finalization Discipline",
    "- Keep changes coherent and minimal.",
    "- Update dependent artifacts if the contract changes.",
    "- Do not start execution work before the required upstream dependencies are satisfied.",
  );

  return lines.join("\n");
}

type ProjectFactoryTaskExecutionRow = typeof projectFactoryTaskExecutions.$inferSelect;

type ProjectFactoryIssueService = Pick<ReturnType<typeof issueService>, "create">;

interface ProjectFactoryServiceDeps {
  issueSvc?: ProjectFactoryIssueService;
  heartbeat?: IssueAssignmentWakeupDeps;
}

function mapReviewRow(row: typeof projectFactoryReviews.$inferSelect): ProjectFactoryExecutionReview {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    executionId: row.executionId,
    taskId: row.taskId,
    verdict: projectFactoryReviewVerdictSchema.parse(row.verdict),
    summary: row.summary,
    decidedByAgentId: row.decidedByAgentId ?? null,
    decidedByUserId: row.decidedByUserId ?? null,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGateEvaluationRow(
  row: typeof projectFactoryGateEvaluations.$inferSelect,
): ProjectFactoryGateEvaluation {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    gateId: row.gateId,
    phaseId: row.phaseId ?? null,
    status: projectFactoryGateEvaluationStatusSchema.parse(row.status),
    summary: row.summary,
    decidedByAgentId: row.decidedByAgentId ?? null,
    decidedByUserId: row.decidedByUserId ?? null,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTaskExecutionRow(
  row: ProjectFactoryTaskExecutionRow,
  executionWorkspace: ExecutionWorkspace | null = null,
): ProjectFactoryTaskExecution {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    taskId: row.taskId,
    taskName: row.taskName,
    taskSpecArtifactKey: row.taskSpecArtifactKey,
    status: projectFactoryTaskExecutionStatusSchema.parse(row.status),
    executionWorkspaceId: row.executionWorkspaceId ?? null,
    projectWorkspaceId: row.projectWorkspaceId ?? null,
    workspaceMode: row.workspaceMode as ProjectFactoryTaskExecution["workspaceMode"],
    workspaceStrategyType: row.workspaceStrategyType as ProjectFactoryTaskExecution["workspaceStrategyType"],
    workspaceProviderType: row.workspaceProviderType as ProjectFactoryTaskExecution["workspaceProviderType"],
    workspaceName: row.workspaceName ?? null,
    branchName: row.branchName ?? null,
    worktreePath: row.worktreePath ?? null,
    completionMarker: row.completionMarker ?? null,
    completionNotes: row.completionNotes ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    launchedByAgentId: row.launchedByAgentId ?? null,
    launchedByUserId: row.launchedByUserId ?? null,
    completedByAgentId: row.completedByAgentId ?? null,
    completedByUserId: row.completedByUserId ?? null,
    launchedAt: row.launchedAt,
    completedAt: row.completedAt ?? null,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    executionWorkspace,
  };
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toExecutionManifestExecution(
  execution: ProjectFactoryTaskExecution,
): ProjectFactoryExecutionManifestExecution {
  return {
    id: execution.id,
    taskId: execution.taskId,
    taskName: execution.taskName,
    taskSpecArtifactKey: execution.taskSpecArtifactKey,
    status: execution.status,
    completionMarker: execution.completionMarker,
    completionNotes: execution.completionNotes,
    launchedAt: execution.launchedAt.toISOString(),
    completedAt: toIsoString(execution.completedAt),
    archivedAt: toIsoString(execution.archivedAt),
    workspace: execution.executionWorkspace
      ? {
          id: execution.executionWorkspace.id,
          name: execution.executionWorkspace.name,
          mode: execution.executionWorkspace.mode,
          strategyType: execution.executionWorkspace.strategyType,
          providerType: execution.executionWorkspace.providerType,
          status: execution.executionWorkspace.status,
          branchName: execution.executionWorkspace.branchName,
          cwd: execution.executionWorkspace.cwd,
          worktreePath: execution.executionWorkspace.providerRef ?? execution.executionWorkspace.cwd,
        }
      : null,
    metadata: execution.metadata,
  };
}

function buildExecutionManifest(args: {
  projectId: string;
  projectName: string;
  executions: ProjectFactoryTaskExecution[];
}): ProjectFactoryExecutionManifest {
  return {
    projectId: args.projectId,
    projectName: args.projectName,
    updatedAt: new Date().toISOString(),
    summary: {
      totalExecutionCount: args.executions.length,
      activeExecutionCount: args.executions.filter((execution) => execution.status === "active").length,
      completedExecutionCount: args.executions.filter((execution) => execution.status === "completed").length,
      archivedExecutionCount: args.executions.filter((execution) => execution.status === "archived").length,
      failedExecutionCount: args.executions.filter((execution) => execution.status === "failed").length,
      cancelledExecutionCount: args.executions.filter((execution) => execution.status === "cancelled").length,
    },
    executions: args.executions.map(toExecutionManifestExecution),
  };
}

function gateStatusToEffective(status: ProjectFactoryGateEvaluationStatus): FactoryGateState["status"] {
  return status;
}

function computeBlockingUpstreamGates(args: {
  manifest: FactoryProjectManifest;
  taskPhaseId: string;
  evaluations: ProjectFactoryGateEvaluation[];
}): Array<{ gateId: string; phaseId: string; effectiveStatus: FactoryGateState["status"] }> {
  const latestEvaluationByGateId = new Map<string, ProjectFactoryGateEvaluation>();
  for (const evaluation of args.evaluations) {
    const existing = latestEvaluationByGateId.get(evaluation.gateId);
    if (!existing || existing.decidedAt < evaluation.decidedAt) {
      latestEvaluationByGateId.set(evaluation.gateId, evaluation);
    }
  }
  return args.manifest.gates
    .filter((gate) => gate.blocking && gate.phaseId < args.taskPhaseId)
    .map((gate) => {
      const latest = latestEvaluationByGateId.get(gate.id);
      const effectiveStatus = latest ? gateStatusToEffective(latest.status) : gate.status;
      return {
        gateId: gate.id,
        phaseId: gate.phaseId,
        effectiveStatus,
      };
    });
}

async function localPathExists(targetPath: string | null | undefined) {
  if (!targetPath) return false;
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildExecutionReviewSummaries(reviews: ProjectFactoryExecutionReview[]) {
  const summariesByExecutionId = new Map<string, ProjectFactoryExecutionReviewSummary>();
  for (const review of reviews) {
    const existing = summariesByExecutionId.get(review.executionId);
    if (existing) {
      existing.reviewCount += 1;
      continue;
    }
    summariesByExecutionId.set(review.executionId, {
      executionId: review.executionId,
      taskId: review.taskId,
      reviewCount: 1,
      latestVerdict: review.verdict,
      latestReviewedAt: review.decidedAt,
    });
  }
  return Array.from(summariesByExecutionId.values());
}

export function projectFactoryService(db: Db, deps: ProjectFactoryServiceDeps = {}) {
  const executionWorkspacesSvc = executionWorkspaceService(db);
  const workspaceOperations = workspaceOperationService(db);
  const issueSvc = deps.issueSvc ?? issueService(db);
  const heartbeat = deps.heartbeat ?? heartbeatService(db);

  async function listGateEvaluationsInternal(projectId: string) {
    const rows = await db
      .select()
      .from(projectFactoryGateEvaluations)
      .where(eq(projectFactoryGateEvaluations.projectId, projectId))
      .orderBy(desc(projectFactoryGateEvaluations.decidedAt), desc(projectFactoryGateEvaluations.createdAt));
    return rows.map(mapGateEvaluationRow);
  }

  async function listExecutionReviewsInternal(projectId: string) {
    const rows = await db
      .select()
      .from(projectFactoryReviews)
      .where(eq(projectFactoryReviews.projectId, projectId))
      .orderBy(desc(projectFactoryReviews.decidedAt), desc(projectFactoryReviews.createdAt));
    return rows.map(mapReviewRow);
  }

  async function getProject(projectId: string) {
    const project = await db
      .select({ id: projects.id, companyId: projects.companyId, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .then((rows) => rows[0] ?? null);
    if (!project) throw notFound("Project not found");
    return project;
  }

  async function listDecisionsInternal(projectId: string) {
    const rows = await db
      .select()
      .from(projectFactoryDecisions)
      .where(eq(projectFactoryDecisions.projectId, projectId))
      .orderBy(desc(projectFactoryDecisions.decidedAt), desc(projectFactoryDecisions.createdAt));
    return rows.map(mapDecisionRow);
  }

  async function buildDecisionRefByQuestionId(projectId: string) {
    const decisions = await db
      .select({ id: projectFactoryDecisions.id, questionId: projectFactoryDecisions.questionId, decidedAt: projectFactoryDecisions.decidedAt })
      .from(projectFactoryDecisions)
      .where(eq(projectFactoryDecisions.projectId, projectId))
      .orderBy(desc(projectFactoryDecisions.decidedAt), desc(projectFactoryDecisions.createdAt));
    const decisionRefByQuestionId = new Map<string, string>();
    for (const decision of decisions) {
      if (decision.questionId && !decisionRefByQuestionId.has(decision.questionId)) {
        decisionRefByQuestionId.set(decision.questionId, decision.id);
      }
    }
    return decisionRefByQuestionId;
  }

  async function loadProjectArtifacts(projectId: string, includeBody: boolean) {
    await getProject(projectId);
    const rows = await db
      .select(artifactSelect)
      .from(projectDocuments)
      .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
      .where(eq(projectDocuments.projectId, projectId))
      .orderBy(asc(projectDocuments.key), desc(documents.updatedAt));
    return rows.map((row) => mapArtifactRow(row, includeBody)) as Array<ProjectFactoryArtifactSummary | ProjectFactoryArtifact>;
  }

  async function loadProjectArtifactByKey(projectId: string, rawKey: string) {
    await getProject(projectId);
    const key = normalizeArtifactKey(rawKey);
    const row = await db
      .select(artifactSelect)
      .from(projectDocuments)
      .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
      .where(and(eq(projectDocuments.projectId, projectId), eq(projectDocuments.key, key)))
      .then((rows) => rows[0] ?? null);
    return row ? (mapArtifactRow(row, true) as ProjectFactoryArtifact) : null;
  }

  async function upsertProjectArtifactInternal(input: {
    projectId: string;
    key: string;
    kind: ProjectFactoryArtifact["kind"];
    title?: string | null;
    format: ProjectFactoryArtifact["format"];
    body: string;
    required?: boolean;
    sourcePath?: string | null;
    description?: string | null;
    changeSummary?: string | null;
    baseRevisionId?: string | null;
    createdByAgentId?: string | null;
    createdByUserId?: string | null;
  }) {
    const project = await getProject(input.projectId);
    const key = normalizeArtifactKey(input.key);

    try {
      return await db.transaction(async (tx) => {
        const now = new Date();
        const existing = await tx
          .select(artifactSelect)
          .from(projectDocuments)
          .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
          .where(and(eq(projectDocuments.projectId, project.id), eq(projectDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (existing) {
          if (!input.baseRevisionId) {
            throw conflict("Artifact update requires baseRevisionId", {
              currentRevisionId: existing.latestRevisionId,
            });
          }
          if (input.baseRevisionId !== existing.latestRevisionId) {
            throw conflict("Artifact was updated by someone else", {
              currentRevisionId: existing.latestRevisionId,
            });
          }

          const nextRevisionNumber = existing.latestRevisionNumber + 1;
          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId: project.companyId,
              documentId: existing.id,
              revisionNumber: nextRevisionNumber,
              title: input.title ?? null,
              format: input.format,
              body: input.body,
              changeSummary: input.changeSummary ?? null,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              createdAt: now,
            })
            .returning();

          await tx
            .update(documents)
            .set({
              title: input.title ?? null,
              format: input.format,
              latestBody: input.body,
              latestRevisionId: revision.id,
              latestRevisionNumber: nextRevisionNumber,
              updatedByAgentId: input.createdByAgentId ?? null,
              updatedByUserId: input.createdByUserId ?? null,
              updatedAt: now,
            })
            .where(eq(documents.id, existing.id));

          await tx
            .update(projectDocuments)
            .set({
              kind: input.kind,
              required: input.required ?? false,
              sourcePath: input.sourcePath ?? null,
              description: input.description ?? null,
            })
            .where(and(eq(projectDocuments.projectId, project.id), eq(projectDocuments.key, key)));

          const updated = await tx
            .select(artifactSelect)
            .from(projectDocuments)
            .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
            .where(and(eq(projectDocuments.projectId, project.id), eq(projectDocuments.key, key)))
            .then((rows) => rows[0]!);

          return {
            created: false,
            artifact: mapArtifactRow(updated, true) as ProjectFactoryArtifact,
          };
        }

        const [document] = await tx
          .insert(documents)
          .values({
            companyId: project.companyId,
            title: input.title ?? null,
            format: input.format,
            latestBody: input.body,
            latestRevisionNumber: 1,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const [revision] = await tx
          .insert(documentRevisions)
          .values({
            companyId: project.companyId,
            documentId: document.id,
            revisionNumber: 1,
            title: input.title ?? null,
            format: input.format,
            body: input.body,
            changeSummary: input.changeSummary ?? null,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        await tx
          .update(documents)
          .set({
            latestRevisionId: revision.id,
            latestRevisionNumber: 1,
          })
          .where(eq(documents.id, document.id));

        await tx.insert(projectDocuments).values({
          companyId: project.companyId,
          projectId: project.id,
          documentId: document.id,
          key,
          kind: input.kind,
          required: input.required ?? false,
          sourcePath: input.sourcePath ?? null,
          description: input.description ?? null,
          createdAt: now,
        });

        const created = await tx
          .select(artifactSelect)
          .from(projectDocuments)
          .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
          .where(and(eq(projectDocuments.projectId, project.id), eq(projectDocuments.key, key)))
          .then((rows) => rows[0]!);

        return {
          created: true,
          artifact: mapArtifactRow(created, true) as ProjectFactoryArtifact,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Project factory artifact already exists", { key });
      }
      throw error;
    }
  }

  async function loadProjectQuestions(projectId: string) {
    await getProject(projectId);
    const decisionRefByQuestionId = await buildDecisionRefByQuestionId(projectId);
    const rows = await db
      .select()
      .from(projectFactoryQuestions)
      .where(eq(projectFactoryQuestions.projectId, projectId))
      .orderBy(asc(projectFactoryQuestions.createdAt));
    return rows.map((row) => mapQuestionRow(row, decisionRefByQuestionId.get(row.id) ?? null));
  }

  async function loadPrimaryProjectWorkspace(projectId: string, companyId: string) {
    const workspace = await db
      .select({
        id: projectWorkspaces.id,
        cwd: projectWorkspaces.cwd,
        repoUrl: projectWorkspaces.repoUrl,
        repoRef: projectWorkspaces.repoRef,
        defaultRef: projectWorkspaces.defaultRef,
        cleanupCommand: projectWorkspaces.cleanupCommand,
      })
      .from(projectWorkspaces)
      .where(
        and(
          eq(projectWorkspaces.projectId, projectId),
          eq(projectWorkspaces.companyId, companyId),
          eq(projectWorkspaces.isPrimary, true),
        ),
      )
      .then((rows) => rows[0] ?? null);
    if (!workspace) {
      throw conflict("Project factory execution requires a primary project workspace");
    }
    if (!workspace.cwd) {
      throw conflict("Project primary workspace needs a local path before task execution can launch");
    }
    return workspace;
  }

  async function listTaskExecutionRows(projectId: string) {
    await getProject(projectId);
    return await db
      .select()
      .from(projectFactoryTaskExecutions)
      .where(eq(projectFactoryTaskExecutions.projectId, projectId))
      .orderBy(desc(projectFactoryTaskExecutions.launchedAt), desc(projectFactoryTaskExecutions.createdAt));
  }

  async function loadTaskExecutionRow(projectId: string, executionId: string) {
    await getProject(projectId);
    const row = await db
      .select()
      .from(projectFactoryTaskExecutions)
      .where(
        and(
          eq(projectFactoryTaskExecutions.projectId, projectId),
          eq(projectFactoryTaskExecutions.id, executionId),
        ),
      )
      .then((rows) => rows[0] ?? null);
    if (!row) {
      throw notFound("Project factory task execution not found");
    }
    return row;
  }

  async function hydrateTaskExecution(row: ProjectFactoryTaskExecutionRow) {
    const executionWorkspace = row.executionWorkspaceId
      ? await executionWorkspacesSvc.getById(row.executionWorkspaceId)
      : null;
    return mapTaskExecutionRow(row, executionWorkspace);
  }

  async function hydrateTaskExecutions(rows: ProjectFactoryTaskExecutionRow[]) {
    return await Promise.all(rows.map((row) => hydrateTaskExecution(row)));
  }

  async function persistExecutionManifest(
    projectId: string,
    actor: { createdByAgentId?: string | null; createdByUserId?: string | null },
    changeSummary: string,
  ) {
    const project = await getProject(projectId);
    const executions = await hydrateTaskExecutions(await listTaskExecutionRows(projectId));
    const manifest = buildExecutionManifest({
      projectId: project.id,
      projectName: project.name,
      executions,
    });
    const manifestKey = "execution-manifest";
    const existing = await loadProjectArtifactByKey(project.id, manifestKey);
    await upsertProjectArtifactInternal({
      projectId: project.id,
      key: manifestKey,
      kind: "report",
      title: "Factory Execution Manifest",
      format: "json",
      body: `${JSON.stringify(manifest, null, 2)}\n`,
      required: false,
      sourcePath: "generated/executions/execution-manifest.json",
      description: "Generated summary of factory task execution state.",
      changeSummary,
      baseRevisionId: existing?.latestRevisionId ?? null,
      createdByAgentId: actor.createdByAgentId ?? null,
      createdByUserId: actor.createdByUserId ?? null,
    });
    return { manifest, manifestKey };
  }

  async function readCompiledManifest(projectId: string) {
    const manifestArtifact = await loadProjectArtifactByKey(projectId, "project-json");
    if (!manifestArtifact) {
      throw conflict("Project factory task execution requires a compiled project-json artifact");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestArtifact.body);
    } catch {
      throw conflict("Compiled project-json artifact is not valid JSON");
    }
    return factoryProjectManifestSchema.parse(parsed);
  }

  async function readProjectExecutionWorkspacePolicy(projectId: string, companyId: string) {
    const projectPolicyRow = await db
      .select({ executionWorkspacePolicy: projects.executionWorkspacePolicy })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    return parseProjectExecutionWorkspacePolicy(projectPolicyRow?.executionWorkspacePolicy ?? null);
  }

  async function writeExecutionLaunchPack(input: {
    execution: ProjectFactoryTaskExecution;
    worktreePath: string;
    taskSpecBody: string;
    executionManifestKey: string;
  }) {
    const launchPackDir = path.join(
      input.worktreePath,
      ".paperclip",
      "factory",
      "executions",
      input.execution.id,
    );
    await fs.mkdir(launchPackDir, { recursive: true });
    await fs.writeFile(path.join(launchPackDir, "TASK.md"), input.taskSpecBody, "utf8");
    await fs.writeFile(
      path.join(launchPackDir, "execution.json"),
      `${JSON.stringify(
        {
          executionId: input.execution.id,
          projectId: input.execution.projectId,
          taskId: input.execution.taskId,
          taskName: input.execution.taskName,
          taskSpecArtifactKey: input.execution.taskSpecArtifactKey,
          executionWorkspaceId: input.execution.executionWorkspaceId,
          projectWorkspaceId: input.execution.projectWorkspaceId,
          branchName: input.execution.branchName,
          worktreePath: input.execution.worktreePath,
          completionMarker: input.execution.completionMarker,
          executionManifestKey: input.executionManifestKey,
          launchedAt: input.execution.launchedAt.toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  async function buildReviewState(projectId: string): Promise<ProjectFactoryReviewState> {
    const project = await getProject(projectId);
    const evaluations = await listGateEvaluationsInternal(project.id);
    const reviews = await listExecutionReviewsInternal(project.id);

    let manifestGates: FactoryProjectManifest["gates"] = DEFAULT_FACTORY_GATES;
    try {
      const manifest = await readCompiledManifest(project.id);
      manifestGates = manifest.gates;
    } catch {
      manifestGates = DEFAULT_FACTORY_GATES;
    }

    const latestEvaluationByGateId = new Map<string, ProjectFactoryGateEvaluation>();
    for (const evaluation of evaluations) {
      const existing = latestEvaluationByGateId.get(evaluation.gateId);
      if (!existing || existing.decidedAt < evaluation.decidedAt) {
        latestEvaluationByGateId.set(evaluation.gateId, evaluation);
      }
    }

    const gates: ProjectFactoryGateState[] = manifestGates.map((gate) => {
      const latestEvaluation = latestEvaluationByGateId.get(gate.id) ?? null;
      const defaultStatus = factoryGateStatusSchema.parse(gate.status);
      const effectiveStatus = latestEvaluation
        ? factoryGateStatusSchema.parse(latestEvaluation.status)
        : defaultStatus;
      return {
        gateId: gate.id,
        phaseId: gate.phaseId,
        title: gate.title,
        blocking: gate.blocking,
        defaultStatus,
        effectiveStatus,
        latestEvaluation,
      };
    });

    return {
      projectId: project.id,
      gates,
      evaluations,
      executionReviewSummaries: buildExecutionReviewSummaries(reviews),
    };
  }

  async function buildRecoverySummary(projectId: string): Promise<ProjectFactoryRecoverySummary> {
    const project = await getProject(projectId);
    const executionRows = await listTaskExecutionRows(project.id);
    const executions = await hydrateTaskExecutions(executionRows);
    const workspaces = await executionWorkspacesSvc.list(project.companyId, { projectId: project.id });
    const referencedWorkspaceIds = new Set(
      executionRows
        .map((row) => row.executionWorkspaceId)
        .filter((value): value is string => Boolean(value)),
    );

    const issues: ProjectFactoryRecoveryIssue[] = [];
    const resumableExecutionIds = new Set<string>();
    const orphanWorkspaceIds = new Set<string>();

    for (const execution of executions) {
      const workspace = execution.executionWorkspace ?? null;
      const workspacePath = workspace?.providerRef ?? workspace?.cwd ?? execution.worktreePath ?? null;
      const workspaceExists = await localPathExists(workspacePath);

      if (!execution.executionWorkspaceId && (execution.status === "active" || execution.status === "failed" || execution.status === "completed")) {
        issues.push({
          kind: "missing_execution_workspace",
          executionId: execution.id,
          taskId: execution.taskId,
          executionWorkspaceId: null,
          workspaceName: execution.workspaceName,
          workspaceStatus: null,
          resumable: false,
          message: `Execution ${execution.id} no longer has a linked execution workspace.`,
        });
      } else if (execution.executionWorkspaceId && !workspace) {
        issues.push({
          kind: "missing_execution_workspace",
          executionId: execution.id,
          taskId: execution.taskId,
          executionWorkspaceId: execution.executionWorkspaceId,
          workspaceName: execution.workspaceName,
          workspaceStatus: null,
          resumable: false,
          message: `Execution ${execution.id} references a workspace that is missing from execution workspace state.`,
        });
      }

      if (workspace?.status === "cleanup_failed") {
        issues.push({
          kind: "cleanup_failed_workspace",
          executionId: execution.id,
          taskId: execution.taskId,
          executionWorkspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceStatus: workspace.status,
          resumable: execution.status === "failed" && workspaceExists,
          message: `Workspace ${workspace.name} is stuck in cleanup_failed state.`,
        });
      }

      if (execution.status === "failed" && workspace && workspace.status !== "archived" && workspaceExists) {
        resumableExecutionIds.add(execution.id);
        issues.push({
          kind: "resumable_execution",
          executionId: execution.id,
          taskId: execution.taskId,
          executionWorkspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceStatus: workspace.status,
          resumable: true,
          message: `Execution ${execution.id} can be resumed because its workspace still exists.`,
        });
      }
    }

    for (const workspace of workspaces) {
      if (referencedWorkspaceIds.has(workspace.id) || workspace.status === "archived") continue;
      orphanWorkspaceIds.add(workspace.id);
      issues.push({
        kind: "orphan_execution_workspace",
        executionId: null,
        taskId: null,
        executionWorkspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceStatus: workspace.status,
        resumable: false,
        message: `Workspace ${workspace.name} is not linked to a factory task execution.`,
      });
    }

    return {
      projectId: project.id,
      issueCount: issues.length,
      resumableExecutionCount: resumableExecutionIds.size,
      orphanWorkspaceCount: orphanWorkspaceIds.size,
      issues,
    };
  }

  return {
    listProjectArtifacts: async (projectId: string) => {
      return await loadProjectArtifacts(projectId, true) as ProjectFactoryArtifact[];
    },

    getProjectArtifactByKey: async (projectId: string, rawKey: string) => {
      return await loadProjectArtifactByKey(projectId, rawKey);
    },

    upsertProjectArtifact: async (input: {
      projectId: string;
      key: string;
      kind: ProjectFactoryArtifact["kind"];
      title?: string | null;
      format: ProjectFactoryArtifact["format"];
      body: string;
      required?: boolean;
      sourcePath?: string | null;
      description?: string | null;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      return await upsertProjectArtifactInternal(input);
    },

    listQuestions: async (projectId: string) => {
      return await loadProjectQuestions(projectId);
    },

    createQuestion: async (
      projectId: string,
      input: {
        text: string;
        helpText?: string | null;
        blocking?: boolean;
        createdByAgentId?: string | null;
        createdByUserId?: string | null;
      },
    ) => {
      const project = await getProject(projectId);
      const [question] = await db
        .insert(projectFactoryQuestions)
        .values({
          companyId: project.companyId,
          projectId: project.id,
          text: input.text,
          helpText: input.helpText ?? null,
          blocking: input.blocking ?? false,
          createdByAgentId: input.createdByAgentId ?? null,
          createdByUserId: input.createdByUserId ?? null,
        })
        .returning();
      return mapQuestionRow(question, null);
    },

    answerQuestion: async (
      projectId: string,
      questionId: string,
      input: {
        answer: string;
        decision: {
          title: string;
          summary: string;
          type: ProjectFactoryDecision["type"];
          decidedBy?: ProjectFactoryDecision["decidedBy"];
          supersedesDecisionId?: string | null;
        };
        answeredByAgentId?: string | null;
        answeredByUserId?: string | null;
      },
    ): Promise<AnswerProjectFactoryQuestionResult> => {
      const project = await getProject(projectId);
      return db.transaction(async (tx) => {
        const question = await tx
          .select()
          .from(projectFactoryQuestions)
          .where(and(eq(projectFactoryQuestions.projectId, project.id), eq(projectFactoryQuestions.id, questionId)))
          .then((rows) => rows[0] ?? null);
        if (!question) throw notFound("Project factory question not found");
        if (question.status === "answered") {
          throw conflict("Project factory question has already been answered");
        }

        const now = new Date();
        const [decision] = await tx
          .insert(projectFactoryDecisions)
          .values({
            companyId: project.companyId,
            projectId: project.id,
            questionId: question.id,
            title: input.decision.title,
            summary: input.decision.summary,
            type: input.decision.type,
            status: "active",
            decidedBy: input.decision.decidedBy ?? "operator",
            decidedByAgentId: input.answeredByAgentId ?? null,
            decidedByUserId: input.answeredByUserId ?? null,
            supersedesDecisionId: input.decision.supersedesDecisionId ?? null,
            decidedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const [updatedQuestion] = await tx
          .update(projectFactoryQuestions)
          .set({
            status: "answered",
            answer: input.answer,
            answeredAt: now,
            answeredByAgentId: input.answeredByAgentId ?? null,
            answeredByUserId: input.answeredByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(projectFactoryQuestions.id, question.id))
          .returning();

        return {
          question: mapQuestionRow(updatedQuestion, decision.id),
          decision: mapDecisionRow(decision),
        };
      });
    },

    listDecisions: async (projectId: string) => {
      await getProject(projectId);
      return listDecisionsInternal(projectId);
    },

    listTaskExecutions: async (projectId: string) => {
      return await hydrateTaskExecutions(await listTaskExecutionRows(projectId));
    },

    launchTaskExecution: async (
      projectId: string,
      input: {
        taskId: string;
        taskSpecArtifactKey?: string | null;
        completionMarker?: string | null;
        notes?: string | null;
        assigneeAgentId?: string | null;
        launchedByAgentId?: string | null;
        launchedByUserId?: string | null;
      },
    ): Promise<ProjectFactoryLaunchTaskExecutionResult> => {
      const project = await getProject(projectId);
      const taskId = projectFactoryTaskIdSchema.parse(input.taskId);
      const manifest = await readCompiledManifest(project.id);
      const task = manifest.chain.tasks.find((entry) => entry.id === taskId);
      if (!task) {
        throw notFound(`Compiled factory task not found: ${taskId}`);
      }

      const taskSpecArtifactKey = normalizeArtifactKey(
        input.taskSpecArtifactKey ?? `task-spec-${task.id.toLowerCase()}`,
      );
      const taskSpecArtifact = await loadProjectArtifactByKey(project.id, taskSpecArtifactKey);
      if (!taskSpecArtifact) {
        throw notFound("Project factory task spec not found");
      }

      const allExecutionRows = await listTaskExecutionRows(project.id);
      const existingExecution = allExecutionRows.find(
        (row) => row.taskId === taskId && row.status !== "archived" && row.status !== "cancelled" && row.status !== "failed",
      );
      if (existingExecution) {
        throw conflict("Project factory task execution already exists for this task", {
          executionId: existingExecution.id,
          status: existingExecution.status,
        });
      }

      const incompletePredecessors = (task.dependsOn ?? []).filter((depId) => {
        const predecessorTask = manifest.chain.tasks.find((entry) => entry.id === depId);
        if (!predecessorTask) {
          return false;
        }

        const predecessorPhaseNumber = Number.parseInt(predecessorTask.phaseId.replace(/^P/, ""), 10);
        if (Number.isNaN(predecessorPhaseNumber) || predecessorPhaseNumber < 3) {
          return false;
        }

        const completedRow = allExecutionRows.find(
          (row) => row.taskId === depId && (row.status === "completed" || row.status === "archived"),
        );
        return !completedRow;
      });
      if (incompletePredecessors.length > 0) {
        throw conflict("Project factory task execution blocked by incomplete predecessor tasks", {
          taskId,
          incompletePredecessors,
        });
      }

      const gateEvaluations = await listGateEvaluationsInternal(project.id);
      const blockingGates = computeBlockingUpstreamGates({
        manifest,
        taskPhaseId: task.phaseId,
        evaluations: gateEvaluations,
      });
      const unapprovedGate = blockingGates.find((gate) => gate.effectiveStatus !== "approved");
      if (unapprovedGate) {
        throw conflict("Project factory task execution blocked by upstream gate", {
          taskId,
          gateId: unapprovedGate.gateId,
          effectiveStatus: unapprovedGate.effectiveStatus,
        });
      }

      const primaryWorkspace = await loadPrimaryProjectWorkspace(project.id, project.companyId);
      const primaryWorkspaceCwd = primaryWorkspace.cwd!;
      const projectPolicy = await readProjectExecutionWorkspacePolicy(project.id, project.companyId);
      const recorder = workspaceOperations.createRecorder({ companyId: project.companyId });
      let realizedWorkspace: Awaited<ReturnType<typeof realizeExecutionWorkspace>> | null = null;
      let persistedExecutionWorkspace: ExecutionWorkspace | null = null;
      let executionRow: ProjectFactoryTaskExecutionRow | null = null;
      let linkedIssue: Awaited<ReturnType<ProjectFactoryIssueService["create"]>> | null = null;

      try {
        realizedWorkspace = await realizeExecutionWorkspace({
          base: {
            baseCwd: primaryWorkspaceCwd,
            source: "project_primary",
            projectId: project.id,
            workspaceId: primaryWorkspace.id,
            repoUrl: primaryWorkspace.repoUrl ?? null,
            repoRef: primaryWorkspace.defaultRef ?? primaryWorkspace.repoRef ?? null,
          },
          config: {
            workspaceStrategy: projectPolicy?.workspaceStrategy ?? {
              type: "git_worktree",
              branchTemplate: "factory/{{project.id}}/{{issue.identifier}}-{{slug}}",
            },
          },
          issue: {
            id: task.id,
            identifier: task.id,
            title: task.name,
          },
          agent: {
            id: input.launchedByAgentId ?? null,
            name: input.launchedByUserId ? "Board" : "Factory",
            companyId: project.companyId,
          },
          recorder,
        });

        const now = new Date();
        persistedExecutionWorkspace = await executionWorkspacesSvc.create({
          companyId: project.companyId,
          projectId: project.id,
          projectWorkspaceId: primaryWorkspace.id,
          sourceIssueId: null,
          mode: "isolated_workspace",
          strategyType: realizedWorkspace.strategy === "git_worktree" ? "git_worktree" : "project_primary",
          name: `${task.id} workspace`,
          status: "active",
          cwd: realizedWorkspace.cwd,
          repoUrl: realizedWorkspace.repoUrl,
          baseRef: realizedWorkspace.repoRef,
          branchName: realizedWorkspace.branchName,
          providerType: realizedWorkspace.strategy === "git_worktree" ? "git_worktree" : "local_fs",
          providerRef: realizedWorkspace.worktreePath,
          lastUsedAt: now,
          openedAt: now,
          metadata: {
            source: realizedWorkspace.source,
            createdByRuntime: realizedWorkspace.created,
            launchNotes: input.notes ?? null,
          },
        });
        if (!persistedExecutionWorkspace) {
          throw conflict("Failed to persist project factory execution workspace");
        }
        await recorder.attachExecutionWorkspaceId(persistedExecutionWorkspace.id);

        const completionMarker = input.completionMarker?.trim() || `TASK_COMPLETED::${task.id}`;
        [executionRow] = await db
          .insert(projectFactoryTaskExecutions)
          .values({
            companyId: project.companyId,
            projectId: project.id,
            taskId: task.id,
            taskName: task.name,
            taskSpecArtifactKey,
            status: "active",
            executionWorkspaceId: persistedExecutionWorkspace.id,
            projectWorkspaceId: primaryWorkspace.id,
            workspaceMode: persistedExecutionWorkspace.mode,
            workspaceStrategyType: persistedExecutionWorkspace.strategyType,
            workspaceProviderType: persistedExecutionWorkspace.providerType,
            workspaceName: persistedExecutionWorkspace.name,
            branchName: persistedExecutionWorkspace.branchName,
            worktreePath: persistedExecutionWorkspace.providerRef ?? persistedExecutionWorkspace.cwd,
            completionMarker,
            metadata: {
              phaseId: task.phaseId,
              wave: task.wave,
              onCriticalPath: task.onCriticalPath,
              launchNotes: input.notes ?? null,
            },
            launchedByAgentId: input.launchedByAgentId ?? null,
            launchedByUserId: input.launchedByUserId ?? null,
            launchedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const execution = await hydrateTaskExecution(executionRow);
        const { manifestKey } = await persistExecutionManifest(
          project.id,
          {
            createdByAgentId: input.launchedByAgentId ?? null,
            createdByUserId: input.launchedByUserId ?? null,
          },
          `Launched execution ${execution.id}`,
        );

        const worktreePath = execution.worktreePath ?? persistedExecutionWorkspace.providerRef ?? persistedExecutionWorkspace.cwd;
        if (!worktreePath) {
          throw conflict("Execution workspace does not expose a local path");
        }
        await writeExecutionLaunchPack({
          execution,
          worktreePath,
          taskSpecBody: taskSpecArtifact.body,
          executionManifestKey: manifestKey,
        });

        if (input.assigneeAgentId) {
          linkedIssue = await issueSvc.create(project.companyId, {
            projectId: project.id,
            projectWorkspaceId: primaryWorkspace.id,
            title: `${task.id} — ${task.name}`,
            description: `Factory execution issue for ${task.id}.\n\nExecution ID: ${execution.id}`,
            status: "todo",
            priority: "high",
            assigneeAgentId: input.assigneeAgentId,
            createdByAgentId: input.launchedByAgentId ?? null,
            createdByUserId: input.launchedByUserId ?? null,
            originKind: "factory_execution",
            originId: execution.id,
            executionWorkspaceId: persistedExecutionWorkspace.id,
            executionWorkspacePreference: "reuse_existing",
          });
          await executionWorkspacesSvc.update(persistedExecutionWorkspace.id, {
            sourceIssueId: linkedIssue.id,
            lastUsedAt: now,
          });
          await queueIssueAssignmentWakeup({
            heartbeat,
            issue: linkedIssue,
            reason: "issue_assigned",
            mutation: "create",
            contextSource: "project_factory.launch",
            requestedByActorType: input.launchedByUserId ? "user" : input.launchedByAgentId ? "agent" : "system",
            requestedByActorId: input.launchedByUserId ?? input.launchedByAgentId ?? null,
            rethrowOnError: true,
          });
        }

        return {
          execution,
          executionWorkspace: await executionWorkspacesSvc.getById(persistedExecutionWorkspace.id),
          executionManifestKey: manifestKey,
          linkedIssue: linkedIssue
            ? {
                id: linkedIssue.id,
                identifier: linkedIssue.identifier ?? null,
                status: linkedIssue.status,
                assigneeAgentId: linkedIssue.assigneeAgentId ?? null,
              }
            : null,
        };
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : String(error);

        if (linkedIssue) {
          await db.delete(issues).where(eq(issues.id, linkedIssue.id));
        }

        if (executionRow) {
          const nextMetadata = {
            ...((executionRow.metadata as Record<string, unknown> | null) ?? {}),
            launchError: failureReason,
          };
          await db
            .update(projectFactoryTaskExecutions)
            .set({
              status: "failed",
              completionNotes: failureReason,
              metadata: nextMetadata,
              updatedAt: new Date(),
            })
            .where(eq(projectFactoryTaskExecutions.id, executionRow.id));
        }

        const workspaceCleanupRecorder = workspaceOperations.createRecorder({
          companyId: project.companyId,
          executionWorkspaceId: persistedExecutionWorkspace?.id ?? null,
        });

        if (persistedExecutionWorkspace) {
          if (persistedExecutionWorkspace.metadata?.createdByRuntime === true) {
            const cleanup = await cleanupExecutionWorkspaceArtifacts({
              workspace: persistedExecutionWorkspace,
              projectWorkspace: {
                cwd: primaryWorkspaceCwd,
                cleanupCommand: primaryWorkspace.cleanupCommand ?? null,
              },
              teardownCommand: projectPolicy?.workspaceStrategy?.teardownCommand ?? null,
              recorder: workspaceCleanupRecorder,
            });
            if (executionRow) {
              await executionWorkspacesSvc.update(persistedExecutionWorkspace.id, {
                status: cleanup.cleaned ? "archived" : "cleanup_failed",
                closedAt: new Date(),
                cleanupReason: cleanup.warnings.length > 0 ? cleanup.warnings.join(" | ") : failureReason,
                lastUsedAt: new Date(),
              });
            } else if (cleanup.cleaned) {
              await db.delete(executionWorkspaces).where(eq(executionWorkspaces.id, persistedExecutionWorkspace.id));
            } else {
              await executionWorkspacesSvc.update(persistedExecutionWorkspace.id, {
                status: "cleanup_failed",
                closedAt: new Date(),
                cleanupReason: cleanup.warnings.length > 0 ? cleanup.warnings.join(" | ") : failureReason,
                lastUsedAt: new Date(),
              });
            }
          } else if (!executionRow) {
            await db.delete(executionWorkspaces).where(eq(executionWorkspaces.id, persistedExecutionWorkspace.id));
          } else {
            await executionWorkspacesSvc.update(persistedExecutionWorkspace.id, {
              status: "cleanup_failed",
              closedAt: new Date(),
              cleanupReason: failureReason,
              lastUsedAt: new Date(),
            });
          }
        } else if (realizedWorkspace?.created) {
          await cleanupExecutionWorkspaceArtifacts({
            workspace: {
              id: `transient-${task.id}`,
              cwd: realizedWorkspace.cwd,
              providerType: realizedWorkspace.strategy === "git_worktree" ? "git_worktree" : "local_fs",
              providerRef: realizedWorkspace.worktreePath,
              branchName: realizedWorkspace.branchName,
              repoUrl: realizedWorkspace.repoUrl,
              baseRef: realizedWorkspace.repoRef,
              projectId: project.id,
              projectWorkspaceId: primaryWorkspace.id,
              sourceIssueId: null,
              metadata: {
                createdByRuntime: true,
                source: realizedWorkspace.source,
              },
            },
            projectWorkspace: {
              cwd: primaryWorkspaceCwd,
              cleanupCommand: primaryWorkspace.cleanupCommand ?? null,
            },
            teardownCommand: projectPolicy?.workspaceStrategy?.teardownCommand ?? null,
            recorder: workspaceCleanupRecorder,
          });
        }

        throw error;
      }
    },

    markTaskExecutionCompleted: async (
      projectId: string,
      executionId: string,
      input: {
        completionMarker?: string | null;
        notes?: string | null;
        completedByAgentId?: string | null;
        completedByUserId?: string | null;
      },
    ): Promise<ProjectFactoryCompleteTaskExecutionResult> => {
      const existing = await loadTaskExecutionRow(projectId, executionId);
      if (existing.status === "completed") {
        throw conflict("Project factory task execution has already been completed");
      }
      if (existing.status === "archived") {
        throw conflict("Archived project factory task execution cannot be completed");
      }
      if (existing.status === "failed" || existing.status === "cancelled") {
        throw conflict(`Project factory task execution in status \"${existing.status}\" cannot be completed`);
      }
      if ((existing.completionMarker ?? null) !== (input.completionMarker?.trim() ?? null)) {
        throw conflict("Project factory completion marker mismatch", {
          expected: existing.completionMarker,
          received: input.completionMarker ?? null,
        });
      }

      const now = new Date();
      const [executionRow] = await db
        .update(projectFactoryTaskExecutions)
        .set({
          status: "completed",
          completionNotes: input.notes ?? existing.completionNotes ?? null,
          completedByAgentId: input.completedByAgentId ?? null,
          completedByUserId: input.completedByUserId ?? null,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(projectFactoryTaskExecutions.id, existing.id))
        .returning();

      const executionWorkspace = existing.executionWorkspaceId
        ? await executionWorkspacesSvc.update(existing.executionWorkspaceId, {
            status: "in_review",
            lastUsedAt: now,
            cleanupReason: null,
          })
        : null;
      const execution = mapTaskExecutionRow(executionRow, executionWorkspace);
      const { manifestKey } = await persistExecutionManifest(
        projectId,
        {
          createdByAgentId: input.completedByAgentId ?? null,
          createdByUserId: input.completedByUserId ?? null,
        },
        `Completed execution ${execution.id}`,
      );

      return {
        execution,
        executionWorkspace,
        executionManifestKey: manifestKey,
      };
    },

    archiveTaskExecution: async (
      projectId: string,
      executionId: string,
      input: {
        notes?: string | null;
        archivedByAgentId?: string | null;
        archivedByUserId?: string | null;
      },
    ): Promise<ProjectFactoryArchiveTaskExecutionResult> => {
      const project = await getProject(projectId);
      const existing = await loadTaskExecutionRow(projectId, executionId);
      if (existing.status === "archived") {
        throw conflict("Project factory task execution has already been archived");
      }

      let cleanup: ProjectFactoryExecutionCleanupResult | null = null;
      let executionWorkspace = existing.executionWorkspaceId
        ? await executionWorkspacesSvc.getById(existing.executionWorkspaceId)
        : null;
      const now = new Date();

      if (executionWorkspace) {
        const primaryWorkspace = await loadPrimaryProjectWorkspace(project.id, project.companyId);
        const projectPolicy = await readProjectExecutionWorkspacePolicy(project.id, project.companyId);
        cleanup = await cleanupExecutionWorkspaceArtifacts({
          workspace: executionWorkspace,
          projectWorkspace: {
            cwd: primaryWorkspace.cwd,
            cleanupCommand: primaryWorkspace.cleanupCommand ?? null,
          },
          cleanupCommand: executionWorkspace.config?.cleanupCommand ?? null,
          teardownCommand:
            executionWorkspace.config?.teardownCommand ?? projectPolicy?.workspaceStrategy?.teardownCommand ?? null,
          recorder: workspaceOperations.createRecorder({
            companyId: project.companyId,
            executionWorkspaceId: executionWorkspace.id,
          }),
        });
        executionWorkspace = await executionWorkspacesSvc.update(executionWorkspace.id, {
          status: cleanup.cleaned ? "archived" : "cleanup_failed",
          closedAt: now,
          cleanupReason: cleanup.warnings.length > 0 ? cleanup.warnings.join(" | ") : null,
          lastUsedAt: now,
        });
      }

      const metadata = ((existing.metadata as Record<string, unknown> | null) ?? null)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
      if (input.notes?.trim()) {
        metadata.archiveNotes = input.notes.trim();
      }
      const [executionRow] = await db
        .update(projectFactoryTaskExecutions)
        .set({
          status: "archived",
          archivedAt: now,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          updatedAt: now,
        })
        .where(eq(projectFactoryTaskExecutions.id, existing.id))
        .returning();
      const execution = mapTaskExecutionRow(executionRow, executionWorkspace);
      const { manifestKey } = await persistExecutionManifest(
        projectId,
        {
          createdByAgentId: input.archivedByAgentId ?? null,
          createdByUserId: input.archivedByUserId ?? null,
        },
        `Archived execution ${execution.id}`,
      );

      return {
        execution,
        executionWorkspace,
        cleanup,
        executionManifestKey: manifestKey,
      };
    },

    compileProject: async (
      projectId: string,
      actor: { createdByAgentId?: string | null; createdByUserId?: string | null },
    ): Promise<ProjectFactoryCompileResult> => {
      const project = await getProject(projectId);
      const artifacts = await loadProjectArtifacts(projectId, false) as ProjectFactoryArtifactSummary[];
      const questions = await loadProjectQuestions(projectId);
      const decisions = await listDecisionsInternal(projectId);

      const missingArtifactKeys = REQUIRED_FACTORY_ARTIFACT_KEYS.filter(
        (key) => !artifacts.some((artifact) => artifact.key === key),
      );
      const blockingQuestionIds = questions
        .filter((question) => question.blocking && question.status !== "answered")
        .map((question) => question.id);

      if (missingArtifactKeys.length > 0 || blockingQuestionIds.length > 0) {
        throw conflict("Project factory compilation requires complete clarified inputs", {
          missingArtifactKeys,
          blockingQuestionIds,
        });
      }

      let seedManifest: FactoryProjectManifest | null = null;
      const existingManifestArtifact = await loadProjectArtifactByKey(project.id, "project-json");
      if (existingManifestArtifact?.body) {
        try {
          seedManifest = factoryProjectManifestSchema.parse(JSON.parse(existingManifestArtifact.body));
        } catch {
          throw conflict("Existing project-json artifact is not valid factory manifest JSON");
        }
      }

      const manifest = factoryProjectManifestSchema.parse(
        seedManifest
          ? rehydrateManifestFromProjectState({
              projectId: project.id,
              artifacts,
              questions,
              decisions,
              blocked: false,
              seedManifest,
            })
          : buildManifestFromProjectState({
              projectId: project.id,
              projectName: project.name,
              artifacts,
              questions,
              decisions,
              blocked: false,
            }),
      );

      const generatedArtifactKeys: string[] = [];
      const generatedTaskSpecKeys: string[] = [];

      const persistGeneratedArtifact = async (input: {
        key: string;
        title: string;
        kind: ProjectFactoryArtifact["kind"];
        format: ProjectFactoryArtifact["format"];
        body: string;
        sourcePath: string;
        description: string;
      }) => {
        const existing = await loadProjectArtifactByKey(project.id, input.key);
        const result = await upsertProjectArtifactInternal({
          projectId: project.id,
          key: input.key,
          kind: input.kind,
          title: input.title,
          format: input.format,
          body: input.body,
          required: true,
          sourcePath: input.sourcePath,
          description: input.description,
          changeSummary: existing ? `Regenerated ${input.key}` : `Generated ${input.key}`,
          baseRevisionId: existing?.latestRevisionId ?? null,
          createdByAgentId: actor.createdByAgentId ?? null,
          createdByUserId: actor.createdByUserId ?? null,
        });
        generatedArtifactKeys.push(result.artifact.key);
        return result.artifact;
      };

      await persistGeneratedArtifact({
        key: "project-json",
        title: existingManifestArtifact?.title ?? "Compiled project.json",
        kind: "dag_manifest",
        format: "json",
        body: `${JSON.stringify(manifest, null, 2)}\n`,
        sourcePath: existingManifestArtifact?.sourcePath ?? "generated/project.json",
        description: existingManifestArtifact?.description ?? "Generated Critical DAG manifest for the project factory.",
      });

      await persistGeneratedArtifact({
        key: "task-specs-readme",
        title: "Generated Task Specs README",
        kind: "task_spec_bundle",
        format: "markdown",
        body: `${buildTaskSpecsReadmeMarkdown(manifest)}\n`,
        sourcePath: "generated/task-specs/README.md",
        description: "Generated task-spec bundle index for the compiled project factory manifest.",
      });

      for (const task of manifest.chain.tasks) {
        const taskKey = `task-spec-${task.id.toLowerCase()}`;
        await persistGeneratedArtifact({
          key: taskKey,
          title: `${task.id} — ${task.name}`,
          kind: "task_spec_bundle",
          format: "markdown",
          body: `${buildTaskSpecMarkdown({ task, manifest, artifacts, decisions })}\n`,
          sourcePath: `generated/task-specs/${task.id}.md`,
          description: `Generated task spec for ${task.id}.`,
        });
        generatedTaskSpecKeys.push(taskKey);
      }

      return {
        manifest,
        generatedArtifactKeys,
        generatedTaskSpecKeys,
      };
    },

    getIntakeSummary: async (projectId: string): Promise<ProjectFactoryIntakeSummary> => {
      const project = await getProject(projectId);
      const [artifacts, questions, decisions] = await Promise.all([
        (async () => {
          const rows = await db
            .select(artifactSelect)
            .from(projectDocuments)
            .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
            .where(eq(projectDocuments.projectId, project.id))
            .orderBy(asc(projectDocuments.key), desc(documents.updatedAt));
          return rows.map((row) => mapArtifactRow(row, false) as ProjectFactoryArtifactSummary);
        })(),
        (async () => {
          const decisionRefByQuestionId = await buildDecisionRefByQuestionId(project.id);
          const rows = await db
            .select()
            .from(projectFactoryQuestions)
            .where(eq(projectFactoryQuestions.projectId, project.id))
            .orderBy(asc(projectFactoryQuestions.createdAt));
          return rows.map((row) => mapQuestionRow(row, decisionRefByQuestionId.get(row.id) ?? null));
        })(),
        listDecisionsInternal(project.id),
      ]);

      const artifactKeySet = new Set(artifacts.map((artifact) => artifact.key));
      const missingContextCandidates: ProjectFactoryMissingContextCandidate[] = REQUIRED_FACTORY_ARTIFACT_KEYS
        .filter((key) => !artifactKeySet.has(key))
        .map((key) => ({
          kind: "artifact",
          key,
          message: `Required factory artifact is missing: ${key}`,
        }));

      for (const question of questions) {
        if (question.blocking && question.status !== "answered") {
          missingContextCandidates.push({
            kind: "question",
            key: question.id,
            message: `Blocking factory question remains unresolved: ${question.text}`,
          });
        }
      }

      return {
        projectId: project.id,
        normalizedProjectRecord: {
          projectId: project.id,
          projectName: project.name,
          artifactKeys: artifacts.map((artifact) => artifact.key),
          answeredQuestionCount: questions.filter((question) => question.status === "answered").length,
          openQuestionCount: questions.filter((question) => question.status === "open").length,
          blockingQuestionCount: questions.filter((question) => question.blocking).length,
        },
        missingContextCandidates,
        artifacts,
        questions,
        decisions,
      };
    },

    listExecutionReviews: async (projectId: string): Promise<ProjectFactoryExecutionReview[]> => {
      await getProject(projectId);
      return await listExecutionReviewsInternal(projectId);
    },

    recordExecutionReview: async (
      projectId: string,
      executionId: string,
      input: {
        verdict: ProjectFactoryReviewVerdict;
        summary: string;
        decidedByAgentId?: string | null;
        decidedByUserId?: string | null;
      },
    ): Promise<ProjectFactoryExecutionReview> => {
      const project = await getProject(projectId);
      const verdict = projectFactoryReviewVerdictSchema.parse(input.verdict);
      const summary = input.summary.trim();
      if (!summary) {
        throw unprocessable("Project factory review summary is required");
      }
      const executionRow = await loadTaskExecutionRow(project.id, executionId);
      const now = new Date();
      const [review] = await db
        .insert(projectFactoryReviews)
        .values({
          companyId: project.companyId,
          projectId: project.id,
          executionId: executionRow.id,
          taskId: executionRow.taskId,
          verdict,
          summary,
          decidedByAgentId: input.decidedByAgentId ?? null,
          decidedByUserId: input.decidedByUserId ?? null,
          decidedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapReviewRow(review);
    },

    listGateEvaluations: async (projectId: string): Promise<ProjectFactoryGateEvaluation[]> => {
      await getProject(projectId);
      return await listGateEvaluationsInternal(projectId);
    },

    recordGateEvaluation: async (
      projectId: string,
      input: {
        gateId: string;
        status: ProjectFactoryGateEvaluationStatus;
        summary: string;
        phaseId?: string | null;
        decidedByAgentId?: string | null;
        decidedByUserId?: string | null;
      },
    ): Promise<ProjectFactoryGateEvaluation> => {
      const project = await getProject(projectId);
      const gateId = projectFactoryGateIdSchema.parse(input.gateId);
      const status = projectFactoryGateEvaluationStatusSchema.parse(input.status);
      const summary = input.summary.trim();
      if (!summary) {
        throw unprocessable("Project factory gate evaluation summary is required");
      }
      // Best-effort phaseId from compiled manifest if available.
      let phaseId = input.phaseId ?? null;
      if (!phaseId) {
        try {
          const manifest = await readCompiledManifest(project.id);
          phaseId = manifest.gates.find((gate) => gate.id === gateId)?.phaseId ?? null;
        } catch {
          phaseId = null;
        }
      }
      const now = new Date();
      const [evaluation] = await db
        .insert(projectFactoryGateEvaluations)
        .values({
          companyId: project.companyId,
          projectId: project.id,
          gateId,
          phaseId,
          status,
          summary,
          decidedByAgentId: input.decidedByAgentId ?? null,
          decidedByUserId: input.decidedByUserId ?? null,
          decidedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapGateEvaluationRow(evaluation);
    },

    getReviewState: async (projectId: string): Promise<ProjectFactoryReviewState> => {
      return await buildReviewState(projectId);
    },

    getRecoverySummary: async (projectId: string): Promise<ProjectFactoryRecoverySummary> => {
      return await buildRecoverySummary(projectId);
    },

    getOperatorSummary: async (projectId: string): Promise<ProjectFactoryOperatorSummary> => {
      const project = await getProject(projectId);
      const questions = await loadProjectQuestions(project.id);
      const executions = await hydrateTaskExecutions(await listTaskExecutionRows(project.id));
      const reviewState = await buildReviewState(project.id);
      const recovery = await buildRecoverySummary(project.id);
      const latestReviewByExecutionId = new Map(
        reviewState.executionReviewSummaries.map((summary) => [summary.executionId, summary]),
      );

      return {
        projectId: project.id,
        openQuestionCount: questions.filter((question) => question.status === "open").length,
        blockingQuestionCount: questions.filter((question) => question.blocking && question.status !== "answered").length,
        pendingGateCount: reviewState.gates.filter(
          (gate) => gate.effectiveStatus === "pending" || gate.effectiveStatus === "ready",
        ).length,
        blockedGateCount: reviewState.gates.filter(
          (gate) => gate.effectiveStatus === "blocked" || gate.effectiveStatus === "rejected",
        ).length,
        approvedGateCount: reviewState.gates.filter((gate) => gate.effectiveStatus === "approved").length,
        pendingReviewCount: executions.filter((execution) => {
          if (execution.status !== "completed") return false;
          return latestReviewByExecutionId.get(execution.id)?.latestVerdict !== "approved";
        }).length,
        activeExecutionCount: executions.filter((execution) => execution.status === "active").length,
        failedExecutionCount: executions.filter((execution) => execution.status === "failed").length,
        recoveryIssueCount: recovery.issueCount,
        resumableExecutionCount: recovery.resumableExecutionCount,
        orphanWorkspaceCount: recovery.orphanWorkspaceCount,
        recovery,
      };
    },

    resumeTaskExecution: async (
      projectId: string,
      executionId: string,
      input: { resumedByAgentId?: string | null; resumedByUserId?: string | null },
    ): Promise<ProjectFactoryResumeTaskExecutionResult> => {
      const existing = await loadTaskExecutionRow(projectId, executionId);
      if (existing.status !== "failed") {
        throw conflict("Only failed project factory task executions can be resumed", {
          executionId: existing.id,
          status: existing.status,
        });
      }
      if (!existing.executionWorkspaceId) {
        throw conflict("Failed project factory task execution has no workspace to resume", {
          executionId: existing.id,
        });
      }

      const workspace = await executionWorkspacesSvc.getById(existing.executionWorkspaceId);
      if (!workspace) {
        throw conflict("Failed project factory task execution workspace no longer exists", {
          executionId: existing.id,
          executionWorkspaceId: existing.executionWorkspaceId,
        });
      }
      if (workspace.status === "archived") {
        throw conflict("Archived execution workspaces cannot be resumed", {
          executionId: existing.id,
          executionWorkspaceId: workspace.id,
        });
      }

      const workspacePath = workspace.providerRef ?? workspace.cwd ?? existing.worktreePath ?? null;
      if (!(await localPathExists(workspacePath))) {
        throw conflict("Failed project factory task execution workspace path no longer exists", {
          executionId: existing.id,
          executionWorkspaceId: workspace.id,
          workspacePath,
        });
      }

      const now = new Date();
      const currentMetadata = (existing.metadata as Record<string, unknown> | null) ?? {};
      const currentResumeCount = typeof currentMetadata.resumeCount === "number" ? currentMetadata.resumeCount : 0;
      const nextMetadata = {
        ...currentMetadata,
        resumeCount: currentResumeCount + 1,
        resumedAt: now.toISOString(),
        resumedByAgentId: input.resumedByAgentId ?? null,
        resumedByUserId: input.resumedByUserId ?? null,
      };

      const [executionRow] = await db
        .update(projectFactoryTaskExecutions)
        .set({
          status: "active",
          completionNotes: null,
          completedAt: null,
          archivedAt: null,
          metadata: nextMetadata,
          updatedAt: now,
        })
        .where(eq(projectFactoryTaskExecutions.id, existing.id))
        .returning();

      const executionWorkspace = await executionWorkspacesSvc.update(existing.executionWorkspaceId, {
        status: "active",
        closedAt: null,
        cleanupReason: null,
        lastUsedAt: now,
      });
      const execution = mapTaskExecutionRow(executionRow, executionWorkspace);
      const { manifestKey } = await persistExecutionManifest(
        projectId,
        {
          createdByAgentId: input.resumedByAgentId ?? null,
          createdByUserId: input.resumedByUserId ?? null,
        },
        `Resumed execution ${execution.id}`,
      );

      return {
        execution,
        executionWorkspace,
        executionManifestKey: manifestKey,
      };
    },
  };
}
