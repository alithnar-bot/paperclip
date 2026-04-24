import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { projectFactoryQuestions } from "./project_factory_questions.js";

export const projectFactoryDecisions = pgTable(
  "project_factory_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => projectFactoryQuestions.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("active"),
    decidedBy: text("decided_by").notNull().default("operator"),
    decidedByAgentId: uuid("decided_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    decidedByUserId: text("decided_by_user_id"),
    supersedesDecisionId: uuid("supersedes_decision_id").references((): AnyPgColumn => projectFactoryDecisions.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("project_factory_decisions_company_project_idx").on(table.companyId, table.projectId),
    companyProjectStatusIdx: index("project_factory_decisions_company_project_status_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
    questionIdx: index("project_factory_decisions_question_idx").on(table.questionId),
  }),
);
