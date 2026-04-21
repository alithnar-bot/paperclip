import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { createDb, ensurePostgresDatabase } from "@paperclipai/db";

export type MemoryJobTestDatabase = {
  connectionString: string;
  cleanup(): Promise<void>;
};

const MEMORY_JOB_TEST_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE companies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  pause_reason text,
  paused_at timestamp with time zone,
  issue_prefix text NOT NULL,
  issue_counter integer NOT NULL DEFAULT 0,
  budget_monthly_cents integer NOT NULL DEFAULT 0,
  spent_monthly_cents integer NOT NULL DEFAULT 0,
  require_board_approval_for_new_agents boolean NOT NULL DEFAULT false,
  feedback_data_sharing_enabled boolean NOT NULL DEFAULT false,
  feedback_data_sharing_consent_at timestamp with time zone,
  feedback_data_sharing_consent_by_user_id text,
  feedback_data_sharing_terms_version text,
  brand_color text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX companies_issue_prefix_idx ON companies (issue_prefix);

CREATE TABLE memory_extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  company_id uuid NOT NULL,
  binding_id uuid NOT NULL,
  binding_key text NOT NULL,
  operation_type text NOT NULL,
  status text DEFAULT 'queued' NOT NULL,
  source_agent_id uuid,
  source_issue_id uuid,
  source_project_id uuid,
  source_goal_id uuid,
  source_heartbeat_run_id uuid,
  hook_kind text,
  provider_job_id text,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  attribution_mode text DEFAULT 'untracked' NOT NULL,
  cost_cents integer DEFAULT 0 NOT NULL,
  result_summary text,
  error_code text,
  error text,
  source_kind text NOT NULL,
  source_ref_json jsonb,
  retry_of_job_id uuid,
  attempt_number integer DEFAULT 1 NOT NULL,
  dispatcher_kind text DEFAULT 'in_process' NOT NULL,
  lease_expires_at timestamp with time zone,
  usage_json jsonb,
  result_json jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT memory_extraction_jobs_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX memory_extraction_jobs_company_status_submitted_idx
  ON memory_extraction_jobs (company_id, status, submitted_at);
CREATE INDEX memory_extraction_jobs_company_status_lease_expires_idx
  ON memory_extraction_jobs (company_id, status, lease_expires_at);
CREATE INDEX memory_extraction_jobs_retry_of_job_idx
  ON memory_extraction_jobs (retry_of_job_id);
`;

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate memory-job test port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

export async function startMemoryJobTestDatabase(
  tempDirPrefix: string,
): Promise<MemoryJobTestDatabase> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), tempDirPrefix));
  const port = await getAvailablePort();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: () => {},
    onError: () => {},
  });

  try {
    await instance.initialise();
    await instance.start();

    const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
    await ensurePostgresDatabase(adminConnectionString, "paperclip");

    const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
    const db = createDb(connectionString) as unknown as {
      $client: {
        unsafe(query: string): Promise<unknown>;
        end(): Promise<unknown>;
      };
    };
    await db.$client.unsafe(MEMORY_JOB_TEST_SCHEMA_SQL);
    await db.$client.end();

    return {
      connectionString,
      cleanup: async () => {
        await instance.stop().catch(() => {});
        fs.rmSync(dataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await instance.stop().catch(() => {});
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw error;
  }
}
