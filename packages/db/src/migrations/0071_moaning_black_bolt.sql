CREATE TABLE "project_factory_gate_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"gate_id" text NOT NULL,
	"phase_id" text,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"decided_by_agent_id" uuid,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_factory_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"execution_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"verdict" text NOT NULL,
	"summary" text NOT NULL,
	"decided_by_agent_id" uuid,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_factory_gate_evaluations" ADD CONSTRAINT "project_factory_gate_evaluations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_gate_evaluations" ADD CONSTRAINT "project_factory_gate_evaluations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_gate_evaluations" ADD CONSTRAINT "project_factory_gate_evaluations_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_reviews" ADD CONSTRAINT "project_factory_reviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_reviews" ADD CONSTRAINT "project_factory_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_reviews" ADD CONSTRAINT "project_factory_reviews_execution_id_project_factory_task_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."project_factory_task_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_reviews" ADD CONSTRAINT "project_factory_reviews_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_factory_gate_evaluations_company_project_idx" ON "project_factory_gate_evaluations" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_factory_gate_evaluations_project_gate_idx" ON "project_factory_gate_evaluations" USING btree ("project_id","gate_id");--> statement-breakpoint
CREATE INDEX "project_factory_reviews_company_project_idx" ON "project_factory_reviews" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_factory_reviews_project_execution_idx" ON "project_factory_reviews" USING btree ("project_id","execution_id");--> statement-breakpoint
CREATE INDEX "project_factory_reviews_project_verdict_idx" ON "project_factory_reviews" USING btree ("project_id","verdict");