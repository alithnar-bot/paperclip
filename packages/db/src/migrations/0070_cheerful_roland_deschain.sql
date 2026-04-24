CREATE TABLE "project_factory_task_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"task_name" text NOT NULL,
	"task_spec_artifact_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"execution_workspace_id" uuid,
	"project_workspace_id" uuid,
	"workspace_mode" text,
	"workspace_strategy_type" text,
	"workspace_provider_type" text,
	"workspace_name" text,
	"branch_name" text,
	"worktree_path" text,
	"completion_marker" text,
	"completion_notes" text,
	"metadata" jsonb,
	"launched_by_agent_id" uuid,
	"launched_by_user_id" text,
	"completed_by_agent_id" uuid,
	"completed_by_user_id" text,
	"launched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_factory_task_executions" ADD CONSTRAINT "project_factory_task_executions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_task_executions" ADD CONSTRAINT "project_factory_task_executions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_task_executions" ADD CONSTRAINT "project_factory_task_executions_execution_workspace_id_execution_workspaces_id_fk" FOREIGN KEY ("execution_workspace_id") REFERENCES "public"."execution_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_task_executions" ADD CONSTRAINT "project_factory_task_executions_project_workspace_id_project_workspaces_id_fk" FOREIGN KEY ("project_workspace_id") REFERENCES "public"."project_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_task_executions" ADD CONSTRAINT "project_factory_task_executions_launched_by_agent_id_agents_id_fk" FOREIGN KEY ("launched_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_factory_task_executions" ADD CONSTRAINT "project_factory_task_executions_completed_by_agent_id_agents_id_fk" FOREIGN KEY ("completed_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_factory_task_executions_company_project_idx" ON "project_factory_task_executions" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_factory_task_executions_company_project_status_idx" ON "project_factory_task_executions" USING btree ("company_id","project_id","status");--> statement-breakpoint
CREATE INDEX "project_factory_task_executions_execution_workspace_idx" ON "project_factory_task_executions" USING btree ("execution_workspace_id");--> statement-breakpoint
CREATE INDEX "project_factory_task_executions_project_task_idx" ON "project_factory_task_executions" USING btree ("project_id","task_id");