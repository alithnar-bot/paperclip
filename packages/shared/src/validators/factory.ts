import { z } from "zod";
import {
  FACTORY_ARTIFACT_KINDS,
  FACTORY_DECISION_ACTORS,
  FACTORY_DECISION_STATUSES,
  FACTORY_DECISION_TYPES,
  FACTORY_GATE_STATUSES,
  FACTORY_MANIFEST_STATUSES,
  FACTORY_METHODOLOGIES,
  FACTORY_QUESTION_STATUSES,
  FACTORY_RISK_LEVELS,
  FACTORY_TASK_STATUSES,
} from "../types/factory.js";

export const factoryArtifactKindSchema = z.enum(FACTORY_ARTIFACT_KINDS);
export const factoryQuestionStatusSchema = z.enum(FACTORY_QUESTION_STATUSES);
export const factoryDecisionTypeSchema = z.enum(FACTORY_DECISION_TYPES);
export const factoryDecisionStatusSchema = z.enum(FACTORY_DECISION_STATUSES);
export const factoryDecisionActorSchema = z.enum(FACTORY_DECISION_ACTORS);
export const factoryGateStatusSchema = z.enum(FACTORY_GATE_STATUSES);
export const factoryTaskStatusSchema = z.enum(FACTORY_TASK_STATUSES);
export const factoryManifestStatusSchema = z.enum(FACTORY_MANIFEST_STATUSES);
export const factoryRiskLevelSchema = z.enum(FACTORY_RISK_LEVELS);
export const factoryMethodologySchema = z.enum(FACTORY_METHODOLOGIES);

export const factoryProjectArtifactSchema = z.object({
  id: z.string().min(1),
  kind: factoryArtifactKindSchema,
  title: z.string().min(1),
  path: z.string().min(1),
  required: z.boolean(),
  description: z.string().nullable().optional().default(null),
}).strict();

export const factoryQuestionStateSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  status: factoryQuestionStatusSchema,
  blocking: z.boolean(),
  answer: z.string().nullable().optional().default(null),
  decisionRef: z.string().nullable().optional().default(null),
}).strict();

export const factoryDecisionRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  type: factoryDecisionTypeSchema,
  status: factoryDecisionStatusSchema,
  decidedBy: factoryDecisionActorSchema,
  decidedAt: z.string().min(1),
}).strict();

export const factoryGateStateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  phaseId: z.string().min(1),
  status: factoryGateStatusSchema,
  criteria: z.array(z.string().min(1)).min(1),
  blocking: z.boolean(),
  dependsOn: z.array(z.string().min(1)).default([]),
}).strict();

export const factoryPhaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional().default(null),
}).strict();

export const factoryTaskManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phaseId: z.string().min(1),
  wave: z.number().int().nonnegative(),
  status: factoryTaskStatusSchema,
  estimateMin: z.number().int().positive(),
  dependsOn: z.array(z.string().min(1)).default([]),
  onCriticalPath: z.boolean(),
  acceptance: z.array(z.string().min(1)).min(1),
}).strict();

export const factoryTaskChainSchema = z.object({
  totalTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
  tasks: z.array(factoryTaskManifestSchema),
}).strict();

export const factoryProjectManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  status: factoryManifestStatusSchema,
  risk: factoryRiskLevelSchema,
  methodology: factoryMethodologySchema,
  description: z.string().min(1),
  phases: z.array(factoryPhaseSchema).min(1),
  artifacts: z.array(factoryProjectArtifactSchema),
  questions: z.array(factoryQuestionStateSchema),
  decisions: z.array(factoryDecisionRecordSchema),
  gates: z.array(factoryGateStateSchema),
  chain: factoryTaskChainSchema,
}).strict().superRefine((value, ctx) => {
  const phaseIds = new Set<string>();
  for (const phase of value.phases) {
    if (phaseIds.has(phase.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate phase id: ${phase.id}`,
        path: ["phases"],
      });
    }
    phaseIds.add(phase.id);
  }

  const decisionIds = new Set(value.decisions.map((decision) => decision.id));
  for (const [index, question] of value.questions.entries()) {
    if (question.decisionRef && !decisionIds.has(question.decisionRef)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Question references missing decision: ${question.decisionRef}`,
        path: ["questions", index, "decisionRef"],
      });
    }
  }

  const gateIds = new Set<string>();
  for (const [index, gate] of value.gates.entries()) {
    if (!phaseIds.has(gate.phaseId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Gate references missing phase: ${gate.phaseId}`,
        path: ["gates", index, "phaseId"],
      });
    }
    if (gateIds.has(gate.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate gate id: ${gate.id}`,
        path: ["gates", index, "id"],
      });
    }
    gateIds.add(gate.id);
  }
  for (const [index, gate] of value.gates.entries()) {
    for (const dependency of gate.dependsOn) {
      if (!gateIds.has(dependency)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Gate dependency references missing gate: ${dependency}`,
          path: ["gates", index, "dependsOn"],
        });
      }
    }
  }

  const taskIds = new Set<string>();
  for (const [index, task] of value.chain.tasks.entries()) {
    if (!phaseIds.has(task.phaseId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Task references missing phase: ${task.phaseId}`,
        path: ["chain", "tasks", index, "phaseId"],
      });
    }
    if (taskIds.has(task.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate task id: ${task.id}`,
        path: ["chain", "tasks", index, "id"],
      });
    }
    taskIds.add(task.id);
  }
  for (const [index, task] of value.chain.tasks.entries()) {
    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Task dependency references missing task: ${dependency}`,
          path: ["chain", "tasks", index, "dependsOn"],
        });
      }
    }
  }

  if (value.chain.totalTasks != value.chain.tasks.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `totalTasks (${value.chain.totalTasks}) must equal task count (${value.chain.tasks.length})`,
      path: ["chain", "totalTasks"],
    });
  }

  const doneCount = value.chain.tasks.filter((task) => task.status === "done").length;
  if (value.chain.completedTasks != doneCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `completedTasks (${value.chain.completedTasks}) must equal done task count (${doneCount})`,
      path: ["chain", "completedTasks"],
    });
  }
});

export type FactoryProjectArtifact = z.infer<typeof factoryProjectArtifactSchema>;
export type FactoryQuestionState = z.infer<typeof factoryQuestionStateSchema>;
export type FactoryDecisionRecord = z.infer<typeof factoryDecisionRecordSchema>;
export type FactoryGateState = z.infer<typeof factoryGateStateSchema>;
export type FactoryPhase = z.infer<typeof factoryPhaseSchema>;
export type FactoryTaskManifest = z.infer<typeof factoryTaskManifestSchema>;
export type FactoryTaskChain = z.infer<typeof factoryTaskChainSchema>;
export type FactoryProjectManifest = z.infer<typeof factoryProjectManifestSchema>;
