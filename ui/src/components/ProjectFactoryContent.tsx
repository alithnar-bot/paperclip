import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectFactoryRecoveryIssue, ProjectFactoryTaskExecution } from "@paperclipai/shared";
import {
  Clock3,
  GitBranch,
  HelpCircle,
  ListTodo,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";
import { projectsApi } from "../api/projects";
import { useToastActions } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { MetricCard } from "./MetricCard";

interface ProjectFactoryContentProps {
  companyId: string;
  projectId: string;
  projectRef: string;
}

function humanizeStatus(value: string) {
  return value.replaceAll("_", " ");
}

function executionStatusClasses(status: ProjectFactoryTaskExecution["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "completed":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "archived":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-200";
    case "cancelled":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function gateStatusClasses(status: string) {
  switch (status) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "blocked":
    case "rejected":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "ready":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "pending":
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
}

function recoveryKindLabel(kind: ProjectFactoryRecoveryIssue["kind"]) {
  switch (kind) {
    case "resumable_execution":
      return "Resumable execution";
    case "missing_execution_workspace":
      return "Missing workspace linkage";
    case "cleanup_failed_workspace":
      return "Cleanup failed workspace";
    case "orphan_execution_workspace":
      return "Orphan execution workspace";
    default:
      return humanizeStatus(kind);
  }
}

export function ProjectFactoryContent({ companyId, projectId, projectRef }: ProjectFactoryContentProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();

  const operatorSummaryQuery = useQuery({
    queryKey: queryKeys.projects.factoryOperatorSummary(projectId),
    queryFn: () => projectsApi.getFactoryOperatorSummary(projectId, companyId),
    enabled: Boolean(projectId && companyId),
  });
  const reviewStateQuery = useQuery({
    queryKey: queryKeys.projects.factoryReviewState(projectId),
    queryFn: () => projectsApi.getFactoryReviewState(projectId, companyId),
    enabled: Boolean(projectId && companyId),
  });
  const recoveryQuery = useQuery({
    queryKey: queryKeys.projects.factoryRecovery(projectId),
    queryFn: () => projectsApi.getFactoryRecovery(projectId, companyId),
    enabled: Boolean(projectId && companyId),
  });
  const executionsQuery = useQuery({
    queryKey: queryKeys.projects.factoryExecutions(projectId),
    queryFn: () => projectsApi.getFactoryExecutions(projectId, companyId),
    enabled: Boolean(projectId && companyId),
  });

  const resumeMutation = useMutation({
    mutationFn: (executionId: string) => projectsApi.resumeFactoryExecution(projectId, executionId, companyId),
    onSuccess: async (_, executionId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.factoryOperatorSummary(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.factoryReviewState(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.factoryRecovery(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.factoryExecutions(projectId) }),
      ]);
      pushToast({
        title: "Factory execution resumed",
        body: `Execution ${executionId} is back in flight.`,
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Failed to resume factory execution",
        body: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
      });
    },
  });

  const isLoading =
    operatorSummaryQuery.isPending || reviewStateQuery.isPending || recoveryQuery.isPending || executionsQuery.isPending;

  const firstError = useMemo(() => {
    return (
      (operatorSummaryQuery.error as Error | null) ??
      (reviewStateQuery.error as Error | null) ??
      (recoveryQuery.error as Error | null) ??
      (executionsQuery.error as Error | null) ??
      null
    );
  }, [executionsQuery.error, operatorSummaryQuery.error, recoveryQuery.error, reviewStateQuery.error]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading factory state...</p>;
  }

  if (firstError || !operatorSummaryQuery.data || !reviewStateQuery.data || !recoveryQuery.data || !executionsQuery.data) {
    return <p className="text-sm text-destructive">{firstError?.message ?? "Factory state is unavailable."}</p>;
  }

  const operatorSummary = operatorSummaryQuery.data;
  const reviewState = reviewStateQuery.data;
  const recovery = recoveryQuery.data;
  const executions = executionsQuery.data;

  return (
    <div className="space-y-6" data-testid="project-factory-content">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Factory control panel</h3>
            <p className="text-sm text-muted-foreground">
              Operator visibility and recovery controls for {projectRef}.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {operatorSummary.recoveryIssueCount > 0
              ? `${operatorSummary.recoveryIssueCount} recovery signals need attention.`
              : "No current recovery blockers."}
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="factory-summary-grid">
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={HelpCircle}
              value={operatorSummary.openQuestionCount}
              label="Open questions"
              description={`${operatorSummary.blockingQuestionCount} blocking`}
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={ShieldAlert}
              value={operatorSummary.pendingGateCount + operatorSummary.blockedGateCount}
              label="Gate pressure"
              description={`${operatorSummary.blockedGateCount} blocked · ${operatorSummary.approvedGateCount} approved`}
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={ListTodo}
              value={operatorSummary.pendingReviewCount}
              label="Pending reviews"
              description={`${reviewState.executionReviewSummaries.length} reviewed executions tracked`}
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={Wrench}
              value={operatorSummary.recoveryIssueCount}
              label="Recovery issues"
              description={`${operatorSummary.resumableExecutionCount} resumable · ${operatorSummary.orphanWorkspaceCount} orphaned`}
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={PlayCircle}
              value={operatorSummary.activeExecutionCount}
              label="Active executions"
              description="Currently running factory tasks"
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={XCircle}
              value={operatorSummary.failedExecutionCount}
              label="Failed executions"
              description="Need review or recovery"
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={Clock3}
              value={operatorSummary.blockingQuestionCount}
              label="Blocking questions"
              description="Compilation or execution blocked"
            />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <MetricCard
              icon={RotateCcw}
              value={operatorSummary.resumableExecutionCount}
              label="Resumable executions"
              description="Can be restarted from surviving workspaces"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gate and review state</h4>
              <p className="mt-1 text-sm text-muted-foreground">Effective gate state and latest review verdicts.</p>
            </div>
          </div>

          <div className="space-y-3">
            {reviewState.gates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gate evaluations yet.</p>
            ) : (
              reviewState.gates.map((gate) => (
                <div key={gate.gateId} className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{gate.title}</p>
                      <p className="text-xs text-muted-foreground">{gate.phaseId} · {gate.blocking ? "Blocking" : "Advisory"}</p>
                    </div>
                    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${gateStatusClasses(gate.effectiveStatus)}`}>
                      {humanizeStatus(gate.effectiveStatus)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {gate.latestEvaluation?.summary ?? "No explicit evaluation recorded yet."}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h5 className="text-sm font-semibold">Execution reviews</h5>
            {reviewState.executionReviewSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No execution reviews recorded yet.</p>
            ) : (
              reviewState.executionReviewSummaries.map((summary) => (
                <div key={summary.executionId} className="flex flex-col gap-1 rounded-lg border border-border/70 bg-background/70 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{summary.taskId}</p>
                    <p className="text-xs text-muted-foreground">{summary.reviewCount} review events recorded</p>
                  </div>
                  <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${gateStatusClasses(summary.latestVerdict ?? "pending")}`}>
                    {summary.latestVerdict ? humanizeStatus(summary.latestVerdict) : "pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recovery queue</h4>
            <p className="mt-1 text-sm text-muted-foreground">Cross-check execution and workspace state before operators intervene.</p>
          </div>

          {recovery.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recovery work is pending.</p>
          ) : (
            <div className="space-y-3">
              {recovery.issues.map((issue, index) => {
                const key = issue.executionId ?? issue.executionWorkspaceId ?? `${issue.kind}-${index}`;
                const isPendingResume = resumeMutation.isPending && resumeMutation.variables === issue.executionId;
                return (
                  <div key={key} className="rounded-lg border border-border/70 bg-background/70 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{recoveryKindLabel(issue.kind)}</p>
                        <p className="text-xs text-muted-foreground">
                          {issue.taskId ? `${issue.taskId} · ` : ""}
                          {issue.workspaceName ?? issue.executionWorkspaceId ?? "Factory workspace"}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${issue.resumable ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                        {issue.resumable ? "Actionable" : "Needs manual follow-up"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{issue.message}</p>
                    {issue.executionId ? (
                      <p className="mt-2 text-xs text-muted-foreground">Execution: {issue.executionId}</p>
                    ) : null}
                    {issue.resumable && issue.executionId ? (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          data-testid={`resume-execution-${issue.executionId}`}
                          disabled={isPendingResume}
                          onClick={() => resumeMutation.mutate(issue.executionId!)}
                        >
                          {isPendingResume ? "Resuming..." : "Resume"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Executions</h4>
            <p className="mt-1 text-sm text-muted-foreground">Tracked factory task executions and their workspace state.</p>
          </div>
        </div>

        {executions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No factory executions have been launched yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {executions.map((execution) => (
              <div key={execution.id} className="rounded-lg border border-border/70 bg-background/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{execution.taskName}</p>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${executionStatusClasses(execution.status)}`}>
                        {humanizeStatus(execution.status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{execution.taskId} · {execution.taskSpecArtifactKey}</p>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:text-right">
                    <span className="inline-flex items-center gap-1 lg:justify-end"><GitBranch className="h-3.5 w-3.5" /> {execution.branchName ?? "No branch"}</span>
                    <span className="inline-flex items-center gap-1 lg:justify-end"><PauseCircle className="h-3.5 w-3.5" /> {execution.workspaceName ?? "No workspace"}</span>
                  </div>
                </div>
                {execution.worktreePath ? (
                  <p className="mt-3 text-xs text-muted-foreground">{execution.worktreePath}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
