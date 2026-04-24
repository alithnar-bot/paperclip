import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  activityLog,
  agentApiKeys,
  agentConfigRevisions,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  agents,
  approvalComments,
  approvals,
  assets,
  budgetIncidents,
  budgetPolicies,
  companies,
  companyLogos,
  companyMemberships,
  companySecrets,
  companySkills,
  companyUserSidebarPreferences,
  costEvents,
  documentRevisions,
  documents,
  environmentLeases,
  environments,
  executionWorkspaces,
  feedbackExports,
  feedbackVotes,
  financeEvents,
  goals,
  heartbeatRunEvents,
  heartbeatRuns,
  inboxDismissals,
  invites,
  issueApprovals,
  issueAttachments,
  issueComments,
  issueDocuments,
  issueExecutionDecisions,
  issueInboxArchives,
  issueLabels,
  issueReadStates,
  issueReferenceMentions,
  issueRelations,
  issueThreadInteractions,
  issueTreeHoldMembers,
  issueTreeHolds,
  issueWorkProducts,
  issues,
  joinRequests,
  labels,
  pluginCompanySettings,
  principalPermissionGrants,
  projectDocuments,
  projectFactoryDecisions,
  projectFactoryGateEvaluations,
  projectFactoryQuestions,
  projectFactoryReviews,
  projectFactoryTaskExecutions,
  projectGoals,
  projects,
  projectWorkspaces,
  routineRuns,
  routines,
  routineTriggers,
  workspaceOperations,
  workspaceRuntimeServices,
} from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";

type CompanyScopedDeleteStep = {
  name: string;
  run: (tx: any, companyId: string) => Promise<unknown>;
};

const COMPANY_SCOPED_DELETE_STEPS: CompanyScopedDeleteStep[] = [
  { name: "heartbeat_run_events", run: (tx, companyId) => tx.delete(heartbeatRunEvents).where(eq(heartbeatRunEvents.companyId, companyId)) },
  { name: "agent_task_sessions", run: (tx, companyId) => tx.delete(agentTaskSessions).where(eq(agentTaskSessions.companyId, companyId)) },
  { name: "activity_log", run: (tx, companyId) => tx.delete(activityLog).where(eq(activityLog.companyId, companyId)) },
  { name: "budget_incidents", run: (tx, companyId) => tx.delete(budgetIncidents).where(eq(budgetIncidents.companyId, companyId)) },
  { name: "approval_comments", run: (tx, companyId) => tx.delete(approvalComments).where(eq(approvalComments.companyId, companyId)) },
  { name: "issue_approvals", run: (tx, companyId) => tx.delete(issueApprovals).where(eq(issueApprovals.companyId, companyId)) },
  { name: "issue_attachments", run: (tx, companyId) => tx.delete(issueAttachments).where(eq(issueAttachments.companyId, companyId)) },
  { name: "issue_comments", run: (tx, companyId) => tx.delete(issueComments).where(eq(issueComments.companyId, companyId)) },
  { name: "issue_documents", run: (tx, companyId) => tx.delete(issueDocuments).where(eq(issueDocuments.companyId, companyId)) },
  { name: "issue_execution_decisions", run: (tx, companyId) => tx.delete(issueExecutionDecisions).where(eq(issueExecutionDecisions.companyId, companyId)) },
  { name: "issue_inbox_archives", run: (tx, companyId) => tx.delete(issueInboxArchives).where(eq(issueInboxArchives.companyId, companyId)) },
  { name: "issue_labels", run: (tx, companyId) => tx.delete(issueLabels).where(eq(issueLabels.companyId, companyId)) },
  { name: "issue_read_states", run: (tx, companyId) => tx.delete(issueReadStates).where(eq(issueReadStates.companyId, companyId)) },
  { name: "issue_reference_mentions", run: (tx, companyId) => tx.delete(issueReferenceMentions).where(eq(issueReferenceMentions.companyId, companyId)) },
  { name: "issue_relations", run: (tx, companyId) => tx.delete(issueRelations).where(eq(issueRelations.companyId, companyId)) },
  { name: "issue_thread_interactions", run: (tx, companyId) => tx.delete(issueThreadInteractions).where(eq(issueThreadInteractions.companyId, companyId)) },
  { name: "issue_tree_hold_members", run: (tx, companyId) => tx.delete(issueTreeHoldMembers).where(eq(issueTreeHoldMembers.companyId, companyId)) },
  { name: "issue_tree_holds", run: (tx, companyId) => tx.delete(issueTreeHolds).where(eq(issueTreeHolds.companyId, companyId)) },
  { name: "feedback_exports", run: (tx, companyId) => tx.delete(feedbackExports).where(eq(feedbackExports.companyId, companyId)) },
  { name: "feedback_votes", run: (tx, companyId) => tx.delete(feedbackVotes).where(eq(feedbackVotes.companyId, companyId)) },
  { name: "finance_events", run: (tx, companyId) => tx.delete(financeEvents).where(eq(financeEvents.companyId, companyId)) },
  { name: "cost_events", run: (tx, companyId) => tx.delete(costEvents).where(eq(costEvents.companyId, companyId)) },
  { name: "environment_leases", run: (tx, companyId) => tx.delete(environmentLeases).where(eq(environmentLeases.companyId, companyId)) },
  { name: "issue_work_products", run: (tx, companyId) => tx.delete(issueWorkProducts).where(eq(issueWorkProducts.companyId, companyId)) },
  { name: "workspace_operations", run: (tx, companyId) => tx.delete(workspaceOperations).where(eq(workspaceOperations.companyId, companyId)) },
  { name: "workspace_runtime_services", run: (tx, companyId) => tx.delete(workspaceRuntimeServices).where(eq(workspaceRuntimeServices.companyId, companyId)) },
  { name: "project_factory_reviews", run: (tx, companyId) => tx.delete(projectFactoryReviews).where(eq(projectFactoryReviews.companyId, companyId)) },
  { name: "project_factory_decisions", run: (tx, companyId) => tx.delete(projectFactoryDecisions).where(eq(projectFactoryDecisions.companyId, companyId)) },
  { name: "project_factory_gate_evaluations", run: (tx, companyId) => tx.delete(projectFactoryGateEvaluations).where(eq(projectFactoryGateEvaluations.companyId, companyId)) },
  { name: "project_factory_task_executions", run: (tx, companyId) => tx.delete(projectFactoryTaskExecutions).where(eq(projectFactoryTaskExecutions.companyId, companyId)) },
  { name: "project_factory_questions", run: (tx, companyId) => tx.delete(projectFactoryQuestions).where(eq(projectFactoryQuestions.companyId, companyId)) },
  { name: "project_goals", run: (tx, companyId) => tx.delete(projectGoals).where(eq(projectGoals.companyId, companyId)) },
  { name: "routine_runs", run: (tx, companyId) => tx.delete(routineRuns).where(eq(routineRuns.companyId, companyId)) },
  { name: "routine_triggers", run: (tx, companyId) => tx.delete(routineTriggers).where(eq(routineTriggers.companyId, companyId)) },
  { name: "routines", run: (tx, companyId) => tx.delete(routines).where(eq(routines.companyId, companyId)) },
  { name: "join_requests", run: (tx, companyId) => tx.delete(joinRequests).where(eq(joinRequests.companyId, companyId)) },
  { name: "invites", run: (tx, companyId) => tx.delete(invites).where(eq(invites.companyId, companyId)) },
  { name: "company_logos", run: (tx, companyId) => tx.delete(companyLogos).where(eq(companyLogos.companyId, companyId)) },
  { name: "project_documents", run: (tx, companyId) => tx.delete(projectDocuments).where(eq(projectDocuments.companyId, companyId)) },
  { name: "document_revisions", run: (tx, companyId) => tx.delete(documentRevisions).where(eq(documentRevisions.companyId, companyId)) },
  { name: "documents", run: (tx, companyId) => tx.delete(documents).where(eq(documents.companyId, companyId)) },
  { name: "labels", run: (tx, companyId) => tx.delete(labels).where(eq(labels.companyId, companyId)) },
  { name: "plugin_company_settings", run: (tx, companyId) => tx.delete(pluginCompanySettings).where(eq(pluginCompanySettings.companyId, companyId)) },
  { name: "inbox_dismissals", run: (tx, companyId) => tx.delete(inboxDismissals).where(eq(inboxDismissals.companyId, companyId)) },
  { name: "company_user_sidebar_preferences", run: (tx, companyId) => tx.delete(companyUserSidebarPreferences).where(eq(companyUserSidebarPreferences.companyId, companyId)) },
  { name: "company_skills", run: (tx, companyId) => tx.delete(companySkills).where(eq(companySkills.companyId, companyId)) },
  { name: "principal_permission_grants", run: (tx, companyId) => tx.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId, companyId)) },
  { name: "company_memberships", run: (tx, companyId) => tx.delete(companyMemberships).where(eq(companyMemberships.companyId, companyId)) },
  { name: "company_secrets", run: (tx, companyId) => tx.delete(companySecrets).where(eq(companySecrets.companyId, companyId)) },
  { name: "agent_api_keys", run: (tx, companyId) => tx.delete(agentApiKeys).where(eq(agentApiKeys.companyId, companyId)) },
  { name: "agent_config_revisions", run: (tx, companyId) => tx.delete(agentConfigRevisions).where(eq(agentConfigRevisions.companyId, companyId)) },
  { name: "agent_runtime_state", run: (tx, companyId) => tx.delete(agentRuntimeState).where(eq(agentRuntimeState.companyId, companyId)) },
  { name: "heartbeat_runs", run: (tx, companyId) => tx.delete(heartbeatRuns).where(eq(heartbeatRuns.companyId, companyId)) },
  { name: "agent_wakeup_requests", run: (tx, companyId) => tx.delete(agentWakeupRequests).where(eq(agentWakeupRequests.companyId, companyId)) },
  { name: "execution_workspaces", run: (tx, companyId) => tx.delete(executionWorkspaces).where(eq(executionWorkspaces.companyId, companyId)) },
  { name: "project_workspaces", run: (tx, companyId) => tx.delete(projectWorkspaces).where(eq(projectWorkspaces.companyId, companyId)) },
  { name: "issues", run: (tx, companyId) => tx.delete(issues).where(eq(issues.companyId, companyId)) },
  { name: "projects", run: (tx, companyId) => tx.delete(projects).where(eq(projects.companyId, companyId)) },
  { name: "goals", run: (tx, companyId) => tx.delete(goals).where(eq(goals.companyId, companyId)) },
  { name: "approvals", run: (tx, companyId) => tx.delete(approvals).where(eq(approvals.companyId, companyId)) },
  { name: "budget_policies", run: (tx, companyId) => tx.delete(budgetPolicies).where(eq(budgetPolicies.companyId, companyId)) },
  { name: "assets", run: (tx, companyId) => tx.delete(assets).where(eq(assets.companyId, companyId)) },
  { name: "agents", run: (tx, companyId) => tx.delete(agents).where(eq(agents.companyId, companyId)) },
  { name: "environments", run: (tx, companyId) => tx.delete(environments).where(eq(environments.companyId, companyId)) },
];

export const COMPANY_SCOPED_DELETE_TARGET_NAMES = COMPANY_SCOPED_DELETE_STEPS.map((step) => step.name);

export function companyService(db: Db) {
  const ISSUE_PREFIX_FALLBACK = "CMP";

  const companySelection = {
    id: companies.id,
    name: companies.name,
    description: companies.description,
    status: companies.status,
    issuePrefix: companies.issuePrefix,
    issueCounter: companies.issueCounter,
    budgetMonthlyCents: companies.budgetMonthlyCents,
    spentMonthlyCents: companies.spentMonthlyCents,
    requireBoardApprovalForNewAgents: companies.requireBoardApprovalForNewAgents,
    feedbackDataSharingEnabled: companies.feedbackDataSharingEnabled,
    feedbackDataSharingConsentAt: companies.feedbackDataSharingConsentAt,
    feedbackDataSharingConsentByUserId: companies.feedbackDataSharingConsentByUserId,
    feedbackDataSharingTermsVersion: companies.feedbackDataSharingTermsVersion,
    brandColor: companies.brandColor,
    logoAssetId: companyLogos.assetId,
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt,
  };

  function enrichCompany<T extends { logoAssetId: string | null }>(company: T) {
    return {
      ...company,
      logoUrl: company.logoAssetId ? `/api/assets/${company.logoAssetId}/content` : null,
    };
  }

  function currentUtcMonthWindow(now = new Date()) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    return {
      start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
    };
  }

  async function getMonthlySpendByCompanyIds(
    companyIds: string[],
    database: Pick<Db, "select"> = db,
  ) {
    if (companyIds.length === 0) return new Map<string, number>();
    const { start, end } = currentUtcMonthWindow();
    const rows = await database
        .select({
          companyId: costEvents.companyId,
          spentMonthlyCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::double precision`,
        })
      .from(costEvents)
      .where(
        and(
          inArray(costEvents.companyId, companyIds),
          gte(costEvents.occurredAt, start),
          lt(costEvents.occurredAt, end),
        ),
      )
      .groupBy(costEvents.companyId);
    return new Map(rows.map((row) => [row.companyId, Number(row.spentMonthlyCents ?? 0)]));
  }

  async function hydrateCompanySpend<T extends { id: string; spentMonthlyCents: number }>(
    rows: T[],
    database: Pick<Db, "select"> = db,
  ) {
    const spendByCompanyId = await getMonthlySpendByCompanyIds(rows.map((row) => row.id), database);
    return rows.map((row) => ({
      ...row,
      spentMonthlyCents: spendByCompanyId.get(row.id) ?? 0,
    }));
  }

  function getCompanyQuery(database: Pick<Db, "select">) {
    return database
      .select(companySelection)
      .from(companies)
      .leftJoin(companyLogos, eq(companyLogos.companyId, companies.id));
  }

  function deriveIssuePrefixBase(name: string) {
    const normalized = name.toUpperCase().replace(/[^A-Z]/g, "");
    return normalized.slice(0, 3) || ISSUE_PREFIX_FALLBACK;
  }

  function suffixForAttempt(attempt: number) {
    if (attempt <= 1) return "";
    return "A".repeat(attempt - 1);
  }

  function isIssuePrefixConflict(error: unknown) {
    const constraint = typeof error === "object" && error !== null && "constraint" in error
      ? (error as { constraint?: string }).constraint
      : typeof error === "object" && error !== null && "constraint_name" in error
        ? (error as { constraint_name?: string }).constraint_name
        : undefined;
    return typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "23505"
      && constraint === "companies_issue_prefix_idx";
  }

  async function createCompanyWithUniquePrefix(data: typeof companies.$inferInsert) {
    const base = deriveIssuePrefixBase(data.name);
    let suffix = 1;
    while (suffix < 10000) {
      const candidate = `${base}${suffixForAttempt(suffix)}`;
      try {
        const rows = await db
          .insert(companies)
          .values({ ...data, issuePrefix: candidate })
          .returning();
        return rows[0];
      } catch (error) {
        if (!isIssuePrefixConflict(error)) throw error;
      }
      suffix += 1;
    }
    throw new Error("Unable to allocate unique issue prefix");
  }

  return {
    list: async () => {
      const rows = await getCompanyQuery(db);
      const hydrated = await hydrateCompanySpend(rows);
      return hydrated.map((row) => enrichCompany(row));
    },

    getById: async (id: string) => {
      const row = await getCompanyQuery(db)
        .where(eq(companies.id, id))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;
      const [hydrated] = await hydrateCompanySpend([row], db);
      return enrichCompany(hydrated);
    },

    create: async (data: typeof companies.$inferInsert) => {
      const created = await createCompanyWithUniquePrefix(data);
      const row = await getCompanyQuery(db)
        .where(eq(companies.id, created.id))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Company not found after creation");
      const [hydrated] = await hydrateCompanySpend([row], db);
      return enrichCompany(hydrated);
    },

    update: (
      id: string,
      data: Partial<typeof companies.$inferInsert> & { logoAssetId?: string | null },
    ) =>
      db.transaction(async (tx) => {
        const existing = await getCompanyQuery(tx)
          .where(eq(companies.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;

        const { logoAssetId, ...companyPatch } = data;

        if (logoAssetId !== undefined && logoAssetId !== null) {
          const nextLogoAsset = await tx
            .select({ id: assets.id, companyId: assets.companyId })
            .from(assets)
            .where(eq(assets.id, logoAssetId))
            .then((rows) => rows[0] ?? null);
          if (!nextLogoAsset) throw notFound("Logo asset not found");
          if (nextLogoAsset.companyId !== existing.id) {
            throw unprocessable("Logo asset must belong to the same company");
          }
        }

        const updated = await tx
          .update(companies)
          .set({ ...companyPatch, updatedAt: new Date() })
          .where(eq(companies.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        if (logoAssetId === null) {
          await tx.delete(companyLogos).where(eq(companyLogos.companyId, id));
        } else if (logoAssetId !== undefined) {
          await tx
            .insert(companyLogos)
            .values({
              companyId: id,
              assetId: logoAssetId,
            })
            .onConflictDoUpdate({
              target: companyLogos.companyId,
              set: {
                assetId: logoAssetId,
                updatedAt: new Date(),
              },
            });
        }

        if (logoAssetId !== undefined && existing.logoAssetId && existing.logoAssetId !== logoAssetId) {
          await tx.delete(assets).where(eq(assets.id, existing.logoAssetId));
        }

        const [hydrated] = await hydrateCompanySpend([{
          ...updated,
          logoAssetId: logoAssetId === undefined ? existing.logoAssetId : logoAssetId,
        }], tx);

        return enrichCompany(hydrated);
      }),

    archive: (id: string) =>
      db.transaction(async (tx) => {
        const updated = await tx
          .update(companies)
          .set({ status: "archived", updatedAt: new Date() })
          .where(eq(companies.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;
        const row = await getCompanyQuery(tx)
          .where(eq(companies.id, id))
          .then((rows) => rows[0] ?? null);
        if (!row) return null;
        const [hydrated] = await hydrateCompanySpend([row], tx);
        return enrichCompany(hydrated);
      }),

    remove: (id: string) =>
      db.transaction(async (tx) => {
        for (const step of COMPANY_SCOPED_DELETE_STEPS) {
          await step.run(tx, id);
        }
        const rows = await tx
          .delete(companies)
          .where(eq(companies.id, id))
          .returning();
        return rows[0] ?? null;
      }),

    stats: () =>
      Promise.all([
        db
          .select({ companyId: agents.companyId, count: count() })
          .from(agents)
          .groupBy(agents.companyId),
        db
          .select({ companyId: issues.companyId, count: count() })
          .from(issues)
          .groupBy(issues.companyId),
      ]).then(([agentRows, issueRows]) => {
        const result: Record<string, { agentCount: number; issueCount: number }> = {};
        for (const row of agentRows) {
          result[row.companyId] = { agentCount: row.count, issueCount: 0 };
        }
        for (const row of issueRows) {
          if (result[row.companyId]) {
            result[row.companyId].issueCount = row.count;
          } else {
            result[row.companyId] = { agentCount: 0, issueCount: row.count };
          }
        }
        return result;
      }),
  };
}
