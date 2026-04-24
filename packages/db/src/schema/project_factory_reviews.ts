import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { projectFactoryTaskExecutions } from "./project_factory_task_executions.js";
import { projects } from "./projects.js";

export const projectFactoryReviews = pgTable(
  "project_factory_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => projectFactoryTaskExecutions.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    verdict: text("verdict").notNull(),
    summary: text("summary").notNull(),
    decidedByAgentId: uuid("decided_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("project_factory_reviews_company_project_idx").on(
      table.companyId,
      table.projectId,
    ),
    projectExecutionIdx: index("project_factory_reviews_project_execution_idx").on(
      table.projectId,
      table.executionId,
    ),
    projectVerdictIdx: index("project_factory_reviews_project_verdict_idx").on(
      table.projectId,
      table.verdict,
    ),
  }),
);
