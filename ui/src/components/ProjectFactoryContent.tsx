import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  factoryProjectManifestSchema,
  type FactoryProjectManifest,
  type ProjectFactoryArtifact,
  type ProjectFactoryRecoveryIssue,
  type ProjectFactoryTaskExecution,
} from "@paperclipai/shared";
import {
  BookOpen,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownBody } from "./MarkdownBody";
import { MetricCard } from "./MetricCard";

export type ProjectFactoryView = "factory" | "critical-dag" | "docs";

interface ProjectFactoryContentProps {
  companyId: string;
  projectId: string;
  projectRef: string;
  view?: ProjectFactoryView;
}

function humanizeStatus(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
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

function taskStatusClasses(status: FactoryProjectManifest["chain"]["tasks"][number]["status"]) {
  switch (status) {
    case "done":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "in_progress":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "blocked":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "cancelled":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "todo":
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

function parseCriticalDagManifest(body: string | null | undefined): FactoryProjectManifest | null {
  if (!body?.trim()) return null;
  try {
    const parsed = JSON.parse(body);
    const result = factoryProjectManifestSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function formatEstimateMinutes(estimateMin: number) {
  if (estimateMin >= 60) {
    const hours = estimateMin / 60;
    const rounded = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
    return `${rounded}h`;
  }
  return `${estimateMin}m`;
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

const preferredFactoryDocKeys = [
  "prd",
  "tech-spec",
  "architecture",
  "decisions",
  "implementation-plan",
  "ontology",
  "repo-readme",
  "task-specs-bundle",
] as const;

function artifactDisplayTitle(artifact: ProjectFactoryArtifact) {
  return artifact.title?.trim() || artifact.key;
}

function artifactOrderWeight(artifact: ProjectFactoryArtifact) {
  const preferredIndex = preferredFactoryDocKeys.indexOf(artifact.key as (typeof preferredFactoryDocKeys)[number]);
  if (preferredIndex >= 0) return preferredIndex;
  if (artifact.key.startsWith("task-spec-")) return preferredFactoryDocKeys.length + 10;
  return preferredFactoryDocKeys.length + 100;
}

function sortFactoryDocumentArtifacts(left: ProjectFactoryArtifact, right: ProjectFactoryArtifact) {
  const weightDiff = artifactOrderWeight(left) - artifactOrderWeight(right);
  if (weightDiff !== 0) return weightDiff;
  return artifactDisplayTitle(left).localeCompare(artifactDisplayTitle(right));
}

function formatArtifactBody(artifact: ProjectFactoryArtifact) {
  if (artifact.format !== "json") return artifact.body;
  try {
    return JSON.stringify(JSON.parse(artifact.body), null, 2);
  } catch {
    return artifact.body;
  }
}

function sanitizeMermaidId(value: string) {
  return `task_${value.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function escapeMermaidLabel(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildCriticalDagMermaid(manifest: FactoryProjectManifest) {
  const phaseNameById = new Map(manifest.phases.map((phase) => [phase.id, phase.name]));
  const waveGroups = Array.from(new Set(manifest.chain.tasks.map((task) => task.wave)))
    .sort((left, right) => left - right)
    .map((wave) => ({
      wave,
      tasks: manifest.chain.tasks.filter((task) => task.wave === wave),
    }));

  const classMap = {
    dagDone: [] as string[],
    dagActive: [] as string[],
    dagBlocked: [] as string[],
    dagCancelled: [] as string[],
    dagTodo: [] as string[],
    dagCritical: [] as string[],
  };

  const mermaidLines = [
    "flowchart LR",
    "  %% Auto-generated from the live factory DAG artifact",
  ];

  for (const { wave, tasks } of waveGroups) {
    mermaidLines.push(`  subgraph wave_${wave}[\"Wave ${wave}\"]`);
    for (const task of tasks) {
      const nodeId = sanitizeMermaidId(task.id);
      const label = escapeMermaidLabel([
        `${task.onCriticalPath ? "★ " : ""}${task.id}`,
        task.name,
        `${phaseNameById.get(task.phaseId) ?? task.phaseId} · ${humanizeStatus(task.status)}`,
      ].join("<br/>"));
      mermaidLines.push(`    ${nodeId}[\"${label}\"]`);
      if (task.status === "done") classMap.dagDone.push(nodeId);
      else if (task.status === "in_progress") classMap.dagActive.push(nodeId);
      else if (task.status === "blocked") classMap.dagBlocked.push(nodeId);
      else if (task.status === "cancelled") classMap.dagCancelled.push(nodeId);
      else classMap.dagTodo.push(nodeId);
      if (task.onCriticalPath) classMap.dagCritical.push(nodeId);
    }
    mermaidLines.push("  end");
  }

  for (const task of manifest.chain.tasks) {
    for (const dependency of task.dependsOn) {
      mermaidLines.push(`  ${sanitizeMermaidId(dependency)} --> ${sanitizeMermaidId(task.id)}`);
    }
  }

  mermaidLines.push(
    "  classDef dagDone fill:#0f766e,stroke:#34d399,color:#ecfdf5;",
    "  classDef dagActive fill:#0b3b7a,stroke:#60a5fa,color:#eff6ff;",
    "  classDef dagBlocked fill:#7f1d1d,stroke:#f87171,color:#fff1f2;",
    "  classDef dagCancelled fill:#78350f,stroke:#fbbf24,color:#fffbeb;",
    "  classDef dagTodo fill:#1f2937,stroke:#94a3b8,color:#f8fafc;",
    "  classDef dagCritical stroke-width:4px,stroke:#22c55e;",
  );

  for (const [className, nodeIds] of Object.entries(classMap)) {
    if (nodeIds.length > 0) {
      mermaidLines.push(`  class ${nodeIds.join(",")} ${className};`);
    }
  }

  return mermaidLines.join("\n");
}

export function ProjectFactoryContent({ companyId, projectId, projectRef, view = "factory" }: ProjectFactoryContentProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const showFactoryView = view === "factory";
  const showCriticalDagView = view === "critical-dag";
  const showDocsView = view === "docs";
  const needsOperatorSummary = showFactoryView;
  const needsReviewState = showFactoryView || showCriticalDagView;
  const needsRecovery = showFactoryView || showCriticalDagView;
  const needsArtifacts = showCriticalDagView || showDocsView;
  const needsExecutions = showFactoryView;

  const operatorSummaryQuery = useQuery({
    queryKey: queryKeys.projects.factoryOperatorSummary(projectId),
    queryFn: () => projectsApi.getFactoryOperatorSummary(projectId, companyId),
    enabled: Boolean(projectId && companyId && needsOperatorSummary),
  });
  const reviewStateQuery = useQuery({
    queryKey: queryKeys.projects.factoryReviewState(projectId),
    queryFn: () => projectsApi.getFactoryReviewState(projectId, companyId),
    enabled: Boolean(projectId && companyId && needsReviewState),
  });
  const recoveryQuery = useQuery({
    queryKey: queryKeys.projects.factoryRecovery(projectId),
    queryFn: () => projectsApi.getFactoryRecovery(projectId, companyId),
    enabled: Boolean(projectId && companyId && needsRecovery),
  });
  const artifactsQuery = useQuery({
    queryKey: queryKeys.projects.factoryArtifacts(projectId),
    queryFn: () => projectsApi.getFactoryArtifacts(projectId, companyId),
    enabled: Boolean(projectId && companyId && needsArtifacts),
  });
  const executionsQuery = useQuery({
    queryKey: queryKeys.projects.factoryExecutions(projectId),
    queryFn: () => projectsApi.getFactoryExecutions(projectId, companyId),
    enabled: Boolean(projectId && companyId && needsExecutions),
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
    (needsOperatorSummary && operatorSummaryQuery.isPending)
    || (needsReviewState && reviewStateQuery.isPending)
    || (needsRecovery && recoveryQuery.isPending)
    || (needsArtifacts && artifactsQuery.isPending)
    || (needsExecutions && executionsQuery.isPending);

  const firstError = useMemo(() => {
    const candidates = [
      needsOperatorSummary ? (operatorSummaryQuery.error as Error | null) : null,
      needsReviewState ? (reviewStateQuery.error as Error | null) : null,
      needsRecovery ? (recoveryQuery.error as Error | null) : null,
      needsArtifacts ? (artifactsQuery.error as Error | null) : null,
      needsExecutions ? (executionsQuery.error as Error | null) : null,
    ];
    return candidates.find((candidate): candidate is Error => candidate instanceof Error) ?? null;
  }, [
    artifactsQuery.error,
    executionsQuery.error,
    needsArtifacts,
    needsExecutions,
    needsOperatorSummary,
    needsRecovery,
    needsReviewState,
    operatorSummaryQuery.error,
    recoveryQuery.error,
    reviewStateQuery.error,
  ]);

  const operatorSummary = operatorSummaryQuery.data ?? null;
  const reviewState = reviewStateQuery.data ?? null;
  const recovery = recoveryQuery.data ?? null;
  const executions = executionsQuery.data ?? [];
  const artifacts = artifactsQuery.data ?? [];
  const documentArtifacts = useMemo(
    () => artifacts
      .filter((artifact) => artifact.body.trim().length > 0 && artifact.key !== "project-json")
      .slice()
      .sort(sortFactoryDocumentArtifacts),
    [artifacts],
  );
  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string | null>(null);

  useEffect(() => {
    if (documentArtifacts.length === 0) {
      setSelectedArtifactKey(null);
      return;
    }
    if (!selectedArtifactKey || !documentArtifacts.some((artifact) => artifact.key === selectedArtifactKey)) {
      setSelectedArtifactKey(documentArtifacts[0]!.key);
    }
  }, [documentArtifacts, selectedArtifactKey]);

  const selectedArtifact = documentArtifacts.find((artifact) => artifact.key === selectedArtifactKey) ?? documentArtifacts[0] ?? null;
  const compiledDagArtifact = artifacts.find((artifact) => artifact.key === "project-json" && artifact.kind === "dag_manifest");
  const compiledDag = useMemo(() => parseCriticalDagManifest(compiledDagArtifact?.body), [compiledDagArtifact?.body]);
  const phaseNameById = new Map(compiledDag?.phases.map((phase) => [phase.id, phase.name]) ?? []);
  const criticalPathTasks = compiledDag?.chain.tasks.filter((task) => task.onCriticalPath) ?? [];
  const waveGroups = compiledDag
    ? Array.from(new Set(compiledDag.chain.tasks.map((task) => task.wave)))
      .sort((left, right) => left - right)
      .map((wave) => ({
        wave,
        tasks: compiledDag.chain.tasks.filter((task) => task.wave === wave),
      }))
    : [];
  const criticalPathEstimateMin = criticalPathTasks.reduce((sum, task) => sum + task.estimateMin, 0);
  const criticalDagGraphMarkdown = useMemo(
    () => (compiledDag ? `\`\`\`mermaid\n${buildCriticalDagMermaid(compiledDag)}\n\`\`\`` : null),
    [compiledDag],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading factory state...</p>;
  }

  if (firstError) {
    return <p className="text-sm text-destructive">{firstError.message}</p>;
  }

  if (
    (needsOperatorSummary && !operatorSummary)
    || (needsReviewState && !reviewState)
    || (needsRecovery && !recovery)
    || (needsArtifacts && !artifactsQuery.data)
    || (needsExecutions && !executionsQuery.data)
  ) {
    return <p className="text-sm text-destructive">Factory state is unavailable.</p>;
  }

  const operatorSummaryData = operatorSummary as NonNullable<typeof operatorSummaryQuery.data>;
  const reviewStateData = reviewState as NonNullable<typeof reviewStateQuery.data>;
  const recoveryData = recovery as NonNullable<typeof recoveryQuery.data>;

  return (
    <div className="space-y-6" data-testid="project-factory-content">
      {showFactoryView ? (
        <>
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Factory control panel</h3>
                <p className="text-sm text-muted-foreground">
                  Operator visibility and recovery controls for {projectRef}.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {operatorSummaryData.recoveryIssueCount > 0
                  ? `${operatorSummaryData.recoveryIssueCount} recovery signals need attention.`
                  : "No current recovery blockers."}
              </div>
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="factory-summary-grid">
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={HelpCircle}
                  value={operatorSummaryData.openQuestionCount}
                  label="Open questions"
                  description={`${operatorSummaryData.blockingQuestionCount} blocking`}
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={ShieldAlert}
                  value={operatorSummaryData.pendingGateCount + operatorSummaryData.blockedGateCount}
                  label="Gate pressure"
                  description={`${operatorSummaryData.blockedGateCount} blocked · ${operatorSummaryData.approvedGateCount} approved`}
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={ListTodo}
                  value={operatorSummaryData.pendingReviewCount}
                  label="Pending reviews"
                  description={`${reviewStateData.executionReviewSummaries.length} reviewed executions tracked`}
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={Wrench}
                  value={operatorSummaryData.recoveryIssueCount}
                  label="Recovery issues"
                  description={`${operatorSummaryData.resumableExecutionCount} resumable · ${operatorSummaryData.orphanWorkspaceCount} orphaned`}
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={PlayCircle}
                  value={operatorSummaryData.activeExecutionCount}
                  label="Active executions"
                  description="Currently running factory tasks"
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={XCircle}
                  value={operatorSummaryData.failedExecutionCount}
                  label="Failed executions"
                  description="Need review or recovery"
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={Clock3}
                  value={operatorSummaryData.blockingQuestionCount}
                  label="Blocking questions"
                  description="Compilation or execution blocked"
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <MetricCard
                  icon={RotateCcw}
                  value={operatorSummaryData.resumableExecutionCount}
                  label="Resumable executions"
                  description="Can be restarted from surviving workspaces"
                />
              </div>
            </div>
          </section>
        </>
      ) : null}

      {showCriticalDagView ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Critical DAG</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                The compiled Critical DAG shows dependency order, critical-path work, and wave-level concurrency.
              </p>
            </div>
            {compiledDag ? (
              <div className="text-xs text-muted-foreground">
                {compiledDag.chain.completedTasks}/{compiledDag.chain.totalTasks} tasks complete
              </div>
            ) : null}
          </div>

          {!compiledDag ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Compile the factory to materialize the current Critical DAG manifest.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Methodology</p>
                <p className="mt-2 text-sm font-medium">{humanizeStatus(compiledDag.methodology)}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Critical path</p>
                <p className="mt-2 text-sm font-medium">{criticalPathTasks.length} tasks · {formatEstimateMinutes(criticalPathEstimateMin)}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Wave plan</p>
                <p className="mt-2 text-sm font-medium">{waveGroups.length} execution waves</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-border/70 bg-background/70 p-4" data-testid="factory-critical-dag-graph">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold">Live DAG graph</h5>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rendered from the current compiled project-json artifact.
                    </p>
                  </div>
                </div>
                <div className="max-h-[34rem] overflow-auto pr-2">
                  {criticalDagGraphMarkdown ? (
                    <MarkdownBody className="text-sm" softBreaks={false} linkIssueReferences={false}>
                      {criticalDagGraphMarkdown}
                    </MarkdownBody>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <h5 className="text-sm font-semibold">Critical path</h5>
                  {criticalPathTasks.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No critical-path tasks are flagged yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {criticalPathTasks.map((task) => (
                        <div key={`critical-${task.id}`} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium">{task.name}</p>
                              <p className="text-xs text-muted-foreground">{task.id} · {phaseNameById.get(task.phaseId) ?? task.phaseId}</p>
                            </div>
                            <span className="inline-flex w-fit items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                              Critical path
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <h5 className="text-sm font-semibold">Wave breakdown</h5>
                  <div className="mt-3 space-y-3">
                    {waveGroups.map(({ wave, tasks }) => (
                      <div key={`wave-${wave}`} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">Wave {wave}</p>
                          <span className="text-xs text-muted-foreground">{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {tasks.map((task) => (
                            <div key={task.id} className="rounded-lg border border-border/70 bg-background/70 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{task.name}</p>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${taskStatusClasses(task.status)}`}>
                                  {humanizeStatus(task.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {task.id} · {phaseNameById.get(task.phaseId) ?? task.phaseId} · {formatEstimateMinutes(task.estimateMin)}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {task.dependsOn.length > 0 ? `Depends on ${task.dependsOn.join(", ")}` : "No upstream dependencies."}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {showDocsView ? (
        <section className="rounded-lg border border-border bg-card p-5" data-testid="factory-docs-viewer">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Factory docs</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Live project artifacts loaded into the factory, including product docs, specs, plans, and generated bundles.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            {documentArtifacts.length} loaded document{documentArtifacts.length === 1 ? "" : "s"}
          </div>
        </div>

        {documentArtifacts.length === 0 || !selectedArtifact ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No factory documents are loaded yet.
          </p>
        ) : (
          <Tabs value={selectedArtifact.key} onValueChange={setSelectedArtifactKey} className="mt-4 space-y-4">
            <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-2 rounded-none border-b border-border bg-transparent p-0">
              {documentArtifacts.map((artifact) => (
                <TabsTrigger key={artifact.key} value={artifact.key} className="max-w-full">
                  {artifactDisplayTitle(artifact)}
                </TabsTrigger>
              ))}
            </TabsList>

            {documentArtifacts.map((artifact) => (
              <TabsContent key={artifact.key} value={artifact.key} className="mt-0">
                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h5 className="text-base font-semibold">{artifactDisplayTitle(artifact)}</h5>
                      {artifact.description ? (
                        <p className="mt-2 text-sm text-muted-foreground">{artifact.description}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground lg:text-right">
                      <span>{humanizeStatus(artifact.kind)}</span>
                      <span>{artifact.format.toUpperCase()}</span>
                      {artifact.sourcePath ? <span>{artifact.sourcePath}</span> : null}
                    </div>
                  </div>
                  <div className="mt-4 max-h-[42rem] overflow-auto rounded-lg border border-border bg-card p-4">
                    {artifact.format === "markdown" ? (
                      <MarkdownBody className="text-sm" softBreaks={false} linkIssueReferences={false}>
                        {artifact.body}
                      </MarkdownBody>
                    ) : (
                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                        {formatArtifactBody(artifact)}
                      </pre>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </section>
      ) : null}

      {showCriticalDagView ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gate and review state</h4>
              <p className="mt-1 text-sm text-muted-foreground">Effective gate state and latest review verdicts.</p>
            </div>
          </div>

          <div className="space-y-3">
            {reviewStateData.gates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gate evaluations yet.</p>
            ) : (
              reviewStateData.gates.map((gate) => (
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
            {reviewStateData.executionReviewSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No execution reviews recorded yet.</p>
            ) : (
              reviewStateData.executionReviewSummaries.map((summary) => (
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

          {recoveryData.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recovery work is pending.</p>
          ) : (
            <div className="space-y-3">
              {recoveryData.issues.map((issue, index) => {
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
      ) : null}

      {showFactoryView ? (
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
      ) : null}
    </div>
  );
}
