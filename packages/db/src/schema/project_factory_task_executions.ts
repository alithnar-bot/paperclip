import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { executionWorkspaces } from "./execution_workspaces.js";
import { projects } from "./projects.js";
import { projectWorkspaces } from "./project_workspaces.js";

export const projectFactoryTaskExecutions = pgTable(
  "project_factory_task_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    taskName: text("task_name").notNull(),
    taskSpecArtifactKey: text("task_spec_artifact_key").notNull(),
    status: text("status").notNull().default("active"),
    executionWorkspaceId: uuid("execution_workspace_id").references(() => executionWorkspaces.id, {
      onDelete: "set null",
    }),
    projectWorkspaceId: uuid("project_workspace_id").references(() => projectWorkspaces.id, {
      onDelete: "set null",
    }),
    workspaceMode: text("workspace_mode"),
    workspaceStrategyType: text("workspace_strategy_type"),
    workspaceProviderType: text("workspace_provider_type"),
    workspaceName: text("workspace_name"),
    branchName: text("branch_name"),
    worktreePath: text("worktree_path"),
    completionMarker: text("completion_marker"),
    completionNotes: text("completion_notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    launchedByAgentId: uuid("launched_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    launchedByUserId: text("launched_by_user_id"),
    completedByAgentId: uuid("completed_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    completedByUserId: text("completed_by_user_id"),
    launchedAt: timestamp("launched_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("project_factory_task_executions_company_project_idx").on(
      table.companyId,
      table.projectId,
    ),
    companyProjectStatusIdx: index("project_factory_task_executions_company_project_status_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
    executionWorkspaceIdx: index("project_factory_task_executions_execution_workspace_idx").on(
      table.executionWorkspaceId,
    ),
    projectTaskIdx: index("project_factory_task_executions_project_task_idx").on(
      table.projectId,
      table.taskId,
    ),
  }),
);
