import type {
  FactoryArtifactKind,
  FactoryDecisionActor,
  FactoryDecisionStatus,
  FactoryDecisionType,
  FactoryGateStatus,
  FactoryProjectManifest,
  FactoryQuestionStatus,
} from "./factory.js";
import type { ExecutionWorkspace } from "./workspace-runtime.js";

export const PROJECT_FACTORY_ARTIFACT_FORMATS = ["markdown", "json"] as const;
export type ProjectFactoryArtifactFormat = (typeof PROJECT_FACTORY_ARTIFACT_FORMATS)[number];

export const PROJECT_FACTORY_TASK_EXECUTION_STATUSES = [
  "active",
  "completed",
  "failed",
  "archived",
  "cancelled",
] as const;
export type ProjectFactoryTaskExecutionStatus = (typeof PROJECT_FACTORY_TASK_EXECUTION_STATUSES)[number];

export interface ProjectFactoryArtifactSummary {
  id: string;
  companyId: string;
  projectId: string;
  key: string;
  kind: FactoryArtifactKind;
  required: boolean;
  sourcePath: string | null;
  description: string | null;
  title: string | null;
  format: ProjectFactoryArtifactFormat;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFactoryArtifact extends ProjectFactoryArtifactSummary {
  body: string;
}

export interface ProjectFactoryQuestion {
  id: string;
  companyId: string;
  projectId: string;
  text: string;
  helpText: string | null;
  status: FactoryQuestionStatus;
  blocking: boolean;
  answer: string | null;
  decisionRef: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  answeredAt: Date | null;
  answeredByAgentId: string | null;
  answeredByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFactoryDecision {
  id: string;
  companyId: string;
  projectId: string;
  questionId: string | null;
  title: string;
  summary: string;
  type: FactoryDecisionType;
  status: FactoryDecisionStatus;
  decidedBy: FactoryDecisionActor;
  decidedByAgentId: string | null;
  decidedByUserId: string | null;
  supersedesDecisionId: string | null;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFactoryMissingContextCandidate {
  kind: "artifact" | "question";
  key: string;
  message: string;
}

export interface ProjectFactoryNormalizedProjectRecord {
  projectId: string;
  projectName: string;
  artifactKeys: string[];
  answeredQuestionCount: number;
  openQuestionCount: number;
  blockingQuestionCount: number;
}

export interface ProjectFactoryIntakeSummary {
  projectId: string;
  normalizedProjectRecord: ProjectFactoryNormalizedProjectRecord;
  missingContextCandidates: ProjectFactoryMissingContextCandidate[];
  artifacts: ProjectFactoryArtifactSummary[];
  questions: ProjectFactoryQuestion[];
  decisions: ProjectFactoryDecision[];
}

export interface AnswerProjectFactoryQuestionResult {
  question: ProjectFactoryQuestion;
  decision: ProjectFactoryDecision;
}

export interface ProjectFactoryCompileResult {
  manifest: FactoryProjectManifest;
  generatedArtifactKeys: string[];
  generatedTaskSpecKeys: string[];
}

export interface ProjectFactoryTaskExecution {
  id: string;
  companyId: string;
  projectId: string;
  taskId: string;
  taskName: string;
  taskSpecArtifactKey: string;
  status: ProjectFactoryTaskExecutionStatus;
  executionWorkspaceId: string | null;
  projectWorkspaceId: string | null;
  workspaceMode: ExecutionWorkspace["mode"] | null;
  workspaceStrategyType: ExecutionWorkspace["strategyType"] | null;
  workspaceProviderType: ExecutionWorkspace["providerType"] | null;
  workspaceName: string | null;
  branchName: string | null;
  worktreePath: string | null;
  completionMarker: string | null;
  completionNotes: string | null;
  metadata: Record<string, unknown> | null;
  launchedByAgentId: string | null;
  launchedByUserId: string | null;
  completedByAgentId: string | null;
  completedByUserId: string | null;
  launchedAt: Date;
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  executionWorkspace?: ExecutionWorkspace | null;
}

export interface ProjectFactoryExecutionManifestExecution {
  id: string;
  taskId: string;
  taskName: string;
  taskSpecArtifactKey: string;
  status: ProjectFactoryTaskExecutionStatus;
  completionMarker: string | null;
  completionNotes: string | null;
  launchedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  workspace: {
    id: string | null;
    name: string | null;
    mode: ExecutionWorkspace["mode"] | null;
    strategyType: ExecutionWorkspace["strategyType"] | null;
    providerType: ExecutionWorkspace["providerType"] | null;
    status: ExecutionWorkspace["status"] | null;
    branchName: string | null;
    cwd: string | null;
    worktreePath: string | null;
  } | null;
  metadata: Record<string, unknown> | null;
}

export interface ProjectFactoryExecutionManifest {
  projectId: string;
  projectName: string;
  updatedAt: string;
  summary: {
    totalExecutionCount: number;
    activeExecutionCount: number;
    completedExecutionCount: number;
    archivedExecutionCount: number;
    failedExecutionCount: number;
    cancelledExecutionCount: number;
  };
  executions: ProjectFactoryExecutionManifestExecution[];
}

export interface ProjectFactoryExecutionCleanupResult {
  cleanedPath: string | null;
  cleaned: boolean;
  warnings: string[];
}

export interface ProjectFactoryLaunchTaskExecutionResult {
  execution: ProjectFactoryTaskExecution;
  executionWorkspace: ExecutionWorkspace | null;
  executionManifestKey: string;
}

export interface ProjectFactoryCompleteTaskExecutionResult {
  execution: ProjectFactoryTaskExecution;
  executionWorkspace: ExecutionWorkspace | null;
  executionManifestKey: string;
}

export interface ProjectFactoryArchiveTaskExecutionResult {
  execution: ProjectFactoryTaskExecution;
  executionWorkspace: ExecutionWorkspace | null;
  cleanup: ProjectFactoryExecutionCleanupResult | null;
  executionManifestKey: string;
}

export const PROJECT_FACTORY_REVIEW_VERDICTS = [
  "pending",
  "approved",
  "changes_requested",
  "rejected",
] as const;
export type ProjectFactoryReviewVerdict = (typeof PROJECT_FACTORY_REVIEW_VERDICTS)[number];

export interface ProjectFactoryExecutionReview {
  id: string;
  companyId: string;
  projectId: string;
  executionId: string;
  taskId: string;
  verdict: ProjectFactoryReviewVerdict;
  summary: string;
  decidedByAgentId: string | null;
  decidedByUserId: string | null;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const PROJECT_FACTORY_GATE_EVALUATION_STATUSES = [
  "pending",
  "ready",
  "approved",
  "rejected",
  "blocked",
] as const;
export type ProjectFactoryGateEvaluationStatus = (typeof PROJECT_FACTORY_GATE_EVALUATION_STATUSES)[number];

export interface ProjectFactoryGateEvaluation {
  id: string;
  companyId: string;
  projectId: string;
  gateId: string;
  phaseId: string | null;
  status: ProjectFactoryGateEvaluationStatus;
  summary: string;
  decidedByAgentId: string | null;
  decidedByUserId: string | null;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFactoryGateState {
  gateId: string;
  phaseId: string;
  title: string;
  blocking: boolean;
  defaultStatus: FactoryGateStatus;
  effectiveStatus: FactoryGateStatus;
  latestEvaluation: ProjectFactoryGateEvaluation | null;
}

export interface ProjectFactoryExecutionReviewSummary {
  executionId: string;
  taskId: string;
  reviewCount: number;
  latestVerdict: ProjectFactoryReviewVerdict | null;
  latestReviewedAt: Date | null;
}

export interface ProjectFactoryReviewState {
  projectId: string;
  gates: ProjectFactoryGateState[];
  evaluations: ProjectFactoryGateEvaluation[];
  executionReviewSummaries: ProjectFactoryExecutionReviewSummary[];
}
