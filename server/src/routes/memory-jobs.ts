import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  listMemoryExtractionJobsQuerySchema,
  rerunMemoryExtractionJobSchema,
} from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { logActivity } from "../services/index.js";
import { memoryJobStore } from "../services/memory-job-store.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function memoryJobRoutes(db: Db) {
  const router = Router();
  const store = memoryJobStore(db);

  router.get("/companies/:companyId/memory/jobs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const query = listMemoryExtractionJobsQuerySchema.parse(req.query);
    const result = await store.list(companyId, query);
    res.json(result);
  });

  router.get("/companies/:companyId/memory/jobs/:jobId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const jobId = req.params.jobId as string;
    assertCompanyAccess(req, companyId);

    const job = await store.getDetail(companyId, jobId);
    if (!job) {
      throw notFound(`Memory job not found: ${jobId}`);
    }

    res.json({ job });
  });

  router.post(
    "/companies/:companyId/memory/jobs/:jobId/rerun",
    validate(rerunMemoryExtractionJobSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const jobId = req.params.jobId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const rerunJob = await store.rerun(companyId, jobId);
      const job = await store.getDetail(companyId, rerunJob.id);
      if (!job) {
        throw notFound(`Memory job not found: ${rerunJob.id}`);
      }

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "memory_job_rerun",
        entityType: "memory_job",
        entityId: job.id,
        details: {
          sourceJobId: jobId,
          bindingKey: job.bindingKey,
          operationType: job.operationType,
          retryOfJobId: job.retryOfJobId,
          attemptNumber: job.attemptNumber,
        },
      });

      res.status(201).json({ job });
    },
  );

  return router;
}
