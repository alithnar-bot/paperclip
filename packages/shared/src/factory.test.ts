import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factoryProjectManifestSchema } from "./validators/factory.js";

const sampleManifestPath = new URL("../../../doc/factory/project.json", import.meta.url);

describe("factory project manifest", () => {
  it("validates the committed sample manifest", () => {
    const sample = JSON.parse(readFileSync(sampleManifestPath, "utf8")) as unknown;
    const parsed = factoryProjectManifestSchema.parse(sample);
    expect(parsed.id).toBe("paperclip-software-factory");
    expect(parsed.chain.totalTasks).toBe(8);
    expect(parsed.gates.map((gate) => gate.id)).toEqual(["G0", "G1", "G2", "G3"]);
  });

  it("rejects manifests with missing task dependencies", () => {
    const sample = JSON.parse(readFileSync(sampleManifestPath, "utf8")) as Record<string, unknown>;
    const chain = sample.chain as { tasks: Array<Record<string, unknown>>; totalTasks: number; completedTasks: number };
    chain.tasks[0] = {
      ...chain.tasks[0],
      dependsOn: ["FS-99"],
    };
    const result = factoryProjectManifestSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });
});
