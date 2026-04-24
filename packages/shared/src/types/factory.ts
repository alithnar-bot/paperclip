export const FACTORY_MANIFEST_STATUSES = ["planning", "active", "blocked", "completed", "archived"] as const;
export type FactoryManifestStatus = (typeof FACTORY_MANIFEST_STATUSES)[number];

export const FACTORY_RISK_LEVELS = ["low", "medium", "high"] as const;
export type FactoryRiskLevel = (typeof FACTORY_RISK_LEVELS)[number];

export const FACTORY_METHODOLOGIES = ["ccpm-dag"] as const;
export type FactoryMethodology = (typeof FACTORY_METHODOLOGIES)[number];

export const FACTORY_ARTIFACT_KINDS = [
  "prd",
  "tech_spec",
  "architecture",
  "decisions",
  "implementation_plan",
  "ontology",
  "dag_manifest",
  "task_spec_bundle",
  "report",
  "other",
] as const;
export type FactoryArtifactKind = (typeof FACTORY_ARTIFACT_KINDS)[number];

export const FACTORY_QUESTION_STATUSES = ["open", "answered", "accepted_assumption", "deferred"] as const;
export type FactoryQuestionStatus = (typeof FACTORY_QUESTION_STATUSES)[number];

export const FACTORY_DECISION_TYPES = ["scope", "product", "architecture", "execution", "gate", "risk", "dependency", "other"] as const;
export type FactoryDecisionType = (typeof FACTORY_DECISION_TYPES)[number];

export const FACTORY_DECISION_STATUSES = ["active", "superseded"] as const;
export type FactoryDecisionStatus = (typeof FACTORY_DECISION_STATUSES)[number];

export const FACTORY_DECISION_ACTORS = ["human", "operator", "system"] as const;
export type FactoryDecisionActor = (typeof FACTORY_DECISION_ACTORS)[number];

export const FACTORY_GATE_STATUSES = ["pending", "ready", "approved", "rejected", "blocked"] as const;
export type FactoryGateStatus = (typeof FACTORY_GATE_STATUSES)[number];

export const FACTORY_TASK_STATUSES = ["todo", "in_progress", "done", "blocked", "cancelled"] as const;
export type FactoryTaskStatus = (typeof FACTORY_TASK_STATUSES)[number];

export interface FactoryProjectArtifact {
  id: string;
  kind: FactoryArtifactKind;
  title: string;
  path: string;
  required: boolean;
  description: string | null;
}

export interface FactoryQuestionState {
  id: string;
  text: string;
  status: FactoryQuestionStatus;
  blocking: boolean;
  answer: string | null;
  decisionRef: string | null;
}

export interface FactoryDecisionRecord {
  id: string;
  title: string;
  summary: string;
  type: FactoryDecisionType;
  status: FactoryDecisionStatus;
  decidedBy: FactoryDecisionActor;
  decidedAt: string;
}

export interface FactoryGateState {
  id: string;
  title: string;
  phaseId: string;
  status: FactoryGateStatus;
  criteria: string[];
  blocking: boolean;
  dependsOn: string[];
}

export interface FactoryPhase {
  id: string;
  name: string;
  description: string | null;
}

export interface FactoryTaskManifest {
  id: string;
  name: string;
  phaseId: string;
  wave: number;
  status: FactoryTaskStatus;
  estimateMin: number;
  dependsOn: string[];
  onCriticalPath: boolean;
  acceptance: string[];
}

export interface FactoryTaskChain {
  totalTasks: number;
  completedTasks: number;
  tasks: FactoryTaskManifest[];
}

export interface FactoryProjectManifest {
  id: string;
  name: string;
  version: string;
  status: FactoryManifestStatus;
  risk: FactoryRiskLevel;
  methodology: FactoryMethodology;
  description: string;
  phases: FactoryPhase[];
  artifacts: FactoryProjectArtifact[];
  questions: FactoryQuestionState[];
  decisions: FactoryDecisionRecord[];
  gates: FactoryGateState[];
  chain: FactoryTaskChain;
}
