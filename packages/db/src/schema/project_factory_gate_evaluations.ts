import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectFactoryGateEvaluations = pgTable(
  "project_factory_gate_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    gateId: text("gate_id").notNull(),
    phaseId: text("phase_id"),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    decidedByAgentId: uuid("decided_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("project_factory_gate_evaluations_company_project_idx").on(
      table.companyId,
      table.projectId,
    ),
    projectGateIdx: index("project_factory_gate_evaluations_project_gate_idx").on(
      table.projectId,
      table.gateId,
    ),
  }),
);
