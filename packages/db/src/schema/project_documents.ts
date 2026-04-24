import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { documents } from "./documents.js";
import { projects } from "./projects.js";

export const projectDocuments = pgTable(
  "project_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    required: boolean("required").notNull().default(false),
    sourcePath: text("source_path"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectKeyUq: uniqueIndex("project_documents_company_project_key_uq").on(
      table.companyId,
      table.projectId,
      table.key,
    ),
    documentUq: uniqueIndex("project_documents_document_uq").on(table.documentId),
    companyProjectIdx: index("project_documents_company_project_idx").on(table.companyId, table.projectId),
  }),
);
