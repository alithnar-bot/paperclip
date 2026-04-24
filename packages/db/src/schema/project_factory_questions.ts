import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectFactoryQuestions = pgTable(
  "project_factory_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    helpText: text("help_text"),
    status: text("status").notNull().default("open"),
    blocking: boolean("blocking").notNull().default(false),
    answer: text("answer"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    answeredByAgentId: uuid("answered_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    answeredByUserId: text("answered_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("project_factory_questions_company_project_idx").on(table.companyId, table.projectId),
    companyProjectStatusIdx: index("project_factory_questions_company_project_status_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
  }),
);
