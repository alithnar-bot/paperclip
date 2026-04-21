import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { memoryJobsApi } from "./memoryJobs";

describe("memoryJobsApi", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.get.mockResolvedValue({ jobs: [], nextOffset: null });
    mockApi.post.mockResolvedValue({ job: { id: "job-1" } });
  });

  it("serializes list filters into the company-scoped memory jobs path", async () => {
    await memoryJobsApi.list("company-1", {
      effectiveState: "stuck",
      bindingKey: "primary",
      operationType: "capture",
      agentId: "agent-1",
      issueId: "issue-1",
      runId: "run-1",
      limit: 25,
      offset: 50,
    });

    expect(mockApi.get).toHaveBeenCalledWith(
      "/companies/company-1/memory/jobs?effectiveState=stuck&bindingKey=primary&operationType=capture&agentId=agent-1&issueId=issue-1&runId=run-1&limit=25&offset=50",
    );
  });

  it("posts reruns to the selected job route", async () => {
    await memoryJobsApi.rerun("company-1", "job-1");

    expect(mockApi.post).toHaveBeenCalledWith(
      "/companies/company-1/memory/jobs/job-1/rerun",
      {},
    );
  });
});
