import type {
  MemoryExtractionJobDetailResponse,
  MemoryExtractionJobEffectiveState,
  MemoryExtractionJobListResponse,
  MemoryExtractionJobOperationType,
  MemoryExtractionJobRerunResponse,
  MemoryExtractionJobStatus,
} from "@paperclipai/shared";
import { api } from "./client";

export interface MemoryJobListFilters {
  status?: MemoryExtractionJobStatus;
  effectiveState?: MemoryExtractionJobEffectiveState;
  bindingKey?: string;
  operationType?: MemoryExtractionJobOperationType;
  agentId?: string;
  issueId?: string;
  runId?: string;
  submittedAfter?: Date | string;
  submittedBefore?: Date | string;
  limit?: number;
  offset?: number;
}

function setDateParam(params: URLSearchParams, key: string, value: Date | string | undefined) {
  if (!value) return;
  params.set(key, value instanceof Date ? value.toISOString() : value);
}

export const memoryJobsApi = {
  list: (companyId: string, filters: MemoryJobListFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.effectiveState) params.set("effectiveState", filters.effectiveState);
    if (filters.bindingKey) params.set("bindingKey", filters.bindingKey);
    if (filters.operationType) params.set("operationType", filters.operationType);
    if (filters.agentId) params.set("agentId", filters.agentId);
    if (filters.issueId) params.set("issueId", filters.issueId);
    if (filters.runId) params.set("runId", filters.runId);
    setDateParam(params, "submittedAfter", filters.submittedAfter);
    setDateParam(params, "submittedBefore", filters.submittedBefore);
    if (filters.limit != null) params.set("limit", String(filters.limit));
    if (filters.offset != null) params.set("offset", String(filters.offset));

    const qs = params.toString();
    return api.get<MemoryExtractionJobListResponse>(
      `/companies/${companyId}/memory/jobs${qs ? `?${qs}` : ""}`,
    );
  },
  get: (companyId: string, jobId: string) =>
    api.get<MemoryExtractionJobDetailResponse>(`/companies/${companyId}/memory/jobs/${jobId}`),
  rerun: (companyId: string, jobId: string) =>
    api.post<MemoryExtractionJobRerunResponse>(`/companies/${companyId}/memory/jobs/${jobId}/rerun`, {}),
};
