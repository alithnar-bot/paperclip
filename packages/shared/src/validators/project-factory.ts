import { z } from "zod";
import {
  FACTORY_ARTIFACT_KINDS,
  FACTORY_DECISION_ACTORS,
  FACTORY_DECISION_TYPES,
  FACTORY_QUESTION_STATUSES,
} from "../types/factory.js";
import {
  PROJECT_FACTORY_ARTIFACT_FORMATS,
  PROJECT_FACTORY_TASK_EXECUTION_STATUSES,
} from "../types/project-factory.js";

export const projectFactoryArtifactKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Artifact key must be lowercase letters, numbers, _ or -");

export const projectFactoryTaskIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Task ID must be letters, numbers, _ or -");

export const projectFactoryArtifactFormatSchema = z.enum(PROJECT_FACTORY_ARTIFACT_FORMATS);
export const projectFactoryArtifactKindSchema = z.enum(FACTORY_ARTIFACT_KINDS);
export const projectFactoryQuestionStatusSchema = z.enum(FACTORY_QUESTION_STATUSES);
export const projectFactoryDecisionTypeSchema = z.enum(FACTORY_DECISION_TYPES);
export const projectFactoryDecisionActorSchema = z.enum(FACTORY_DECISION_ACTORS);
export const projectFactoryTaskExecutionStatusSchema = z.enum(PROJECT_FACTORY_TASK_EXECUTION_STATUSES);

export const upsertProjectFactoryArtifactSchema = z.object({
  kind: projectFactoryArtifactKindSchema,
  title: z.string().trim().max(200).nullable().optional(),
  format: projectFactoryArtifactFormatSchema,
  body: z.string().max(524288),
  required: z.boolean().optional().default(false),
  sourcePath: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  changeSummary: z.string().trim().max(500).nullable().optional(),
  baseRevisionId: z.string().uuid().nullable().optional(),
});

export type UpsertProjectFactoryArtifact = z.infer<typeof upsertProjectFactoryArtifactSchema>;

export const createProjectFactoryQuestionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  helpText: z.string().trim().max(2000).nullable().optional(),
  blocking: z.boolean().optional().default(false),
});

export type CreateProjectFactoryQuestion = z.infer<typeof createProjectFactoryQuestionSchema>;

export const createProjectFactoryDecisionSchema = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(4000),
  type: projectFactoryDecisionTypeSchema,
  decidedBy: projectFactoryDecisionActorSchema.optional().default("operator"),
  supersedesDecisionId: z.string().uuid().nullable().optional(),
});

export type CreateProjectFactoryDecision = z.infer<typeof createProjectFactoryDecisionSchema>;

export const answerProjectFactoryQuestionSchema = z.object({
  answer: z.string().trim().min(1).max(10000),
  decision: createProjectFactoryDecisionSchema,
});

export type AnswerProjectFactoryQuestion = z.infer<typeof answerProjectFactoryQuestionSchema>;

export const launchProjectFactoryTaskExecutionSchema = z.object({
  taskId: projectFactoryTaskIdSchema,
  taskSpecArtifactKey: projectFactoryArtifactKeySchema.nullable().optional(),
  completionMarker: z.string().trim().min(1).max(500).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export type LaunchProjectFactoryTaskExecution = z.infer<typeof launchProjectFactoryTaskExecutionSchema>;

export const completeProjectFactoryTaskExecutionSchema = z.object({
  completionMarker: z.string().trim().min(1).max(500).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export type CompleteProjectFactoryTaskExecution = z.infer<typeof completeProjectFactoryTaskExecutionSchema>;

export const archiveProjectFactoryTaskExecutionSchema = z.object({
  notes: z.string().trim().max(4000).nullable().optional(),
});

export type ArchiveProjectFactoryTaskExecution = z.infer<typeof archiveProjectFactoryTaskExecutionSchema>;
