import type {
  BillingType,
  MemoryExtractionJobAttributionMode,
  MemoryExtractionJobDispatcherKind,
  MemoryExtractionJobEffectiveState,
  MemoryExtractionJobHookKind,
  MemoryExtractionJobOperationType,
  MemoryExtractionJobSourceKind,
  MemoryExtractionJobStatus,
} from "../constants.js";

export interface MemoryExtractionJobSourceRef {
  commentId?: string | null;
  documentKey?: string | null;
  subjectId?: string | null;
  namespace?: string | null;
  [key: string]: unknown;
}

export interface MemoryExtractionJobUsage {
  provider: string;
  biller?: string | null;
  model?: string | null;
  billingType?: BillingType | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  embeddingTokens?: number | null;
  costCents?: number | null;
  latencyMs?: number | null;
  details?: Record<string, unknown> | null;
}

export interface MemoryExtractionJob {
  id: string;
  companyId: string;
  bindingId: string;
  bindingKey: string;
  operationType: MemoryExtractionJobOperationType;
  status: MemoryExtractionJobStatus;
  sourceAgentId: string | null;
  sourceIssueId: string | null;
  sourceProjectId: string | null;
  sourceGoalId: string | null;
  sourceHeartbeatRunId: string | null;
  hookKind: MemoryExtractionJobHookKind | null;
  providerJobId: string | null;
  submittedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  attributionMode: MemoryExtractionJobAttributionMode;
  costCents: number;
  resultSummary: string | null;
  errorCode: string | null;
  error: string | null;
  sourceKind: MemoryExtractionJobSourceKind;
  sourceRefJson: MemoryExtractionJobSourceRef | null;
  retryOfJobId: string | null;
  attemptNumber: number;
  dispatcherKind: MemoryExtractionJobDispatcherKind;
  leaseExpiresAt: Date | null;
  usageJson: MemoryExtractionJobUsage | null;
  resultJson: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryExtractionJobListItem {
  id: string;
  bindingId: string;
  bindingKey: string;
  operationType: MemoryExtractionJobOperationType;
  status: MemoryExtractionJobStatus;
  effectiveState: MemoryExtractionJobEffectiveState;
  sourceAgentId: string | null;
  sourceIssueId: string | null;
  sourceProjectId: string | null;
  sourceGoalId: string | null;
  sourceHeartbeatRunId: string | null;
  hookKind: MemoryExtractionJobHookKind | null;
  providerJobId: string | null;
  submittedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  attributionMode: MemoryExtractionJobAttributionMode;
  costCents: number;
  resultSummary: string | null;
  errorCode: string | null;
  error: string | null;
  retryOfJobId: string | null;
  attemptNumber: number;
  retryCount: number;
}

export interface MemoryExtractionJobDetail extends MemoryExtractionJob {
  effectiveState: MemoryExtractionJobEffectiveState;
  retryCount: number;
  rerunEligible: boolean;
}

export interface MemoryExtractionJobListResponse {
  jobs: MemoryExtractionJobListItem[];
  nextOffset: number | null;
}

export interface MemoryExtractionJobDetailResponse {
  job: MemoryExtractionJobDetail;
}

export interface MemoryExtractionJobRerunResponse {
  job: MemoryExtractionJobDetail;
}
