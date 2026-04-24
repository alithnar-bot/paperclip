CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"source_path" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_factory_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"text" text NOT NULL,
	"help_text" text,
	"status" text DEFAULT 'open' NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"answer" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"answered_at" timestamp with time zone,
	"answered_by_agent_id" uuid,
	"answered_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_factory_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"question_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"decided_by" text DEFAULT 'operator' NOT NULL,
	"decided_by_agent_id" uuid,
	"decided_by_user_id" text,
	"supersedes_decision_id" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_questions" ADD CONSTRAINT "project_factory_questions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_questions" ADD CONSTRAINT "project_factory_questions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_questions" ADD CONSTRAINT "project_factory_questions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_questions" ADD CONSTRAINT "project_factory_questions_answered_by_agent_id_agents_id_fk" FOREIGN KEY ("answered_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_decisions" ADD CONSTRAINT "project_factory_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_decisions" ADD CONSTRAINT "project_factory_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_decisions" ADD CONSTRAINT "project_factory_decisions_question_id_project_factory_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."project_factory_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_decisions" ADD CONSTRAINT "project_factory_decisions_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_decisions" ADD CONSTRAINT "project_factory_decisions_supersedes_decision_id_project_factory_decisions_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "public"."project_factory_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_documents_company_project_key_uq" ON "project_documents" USING btree ("company_id","project_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_documents_document_uq" ON "project_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "project_documents_company_project_idx" ON "project_documents" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_factory_questions_company_project_idx" ON "project_factory_questions" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_factory_questions_company_project_status_idx" ON "project_factory_questions" USING btree ("company_id","project_id","status");--> statement-breakpoint
CREATE INDEX "project_factory_decisions_company_project_idx" ON "project_factory_decisions" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_factory_decisions_company_project_status_idx" ON "project_factory_decisions" USING btree ("company_id","project_id","status");--> statement-breakpoint
CREATE INDEX "project_factory_decisions_question_idx" ON "project_factory_decisions" USING btree ("question_id");
