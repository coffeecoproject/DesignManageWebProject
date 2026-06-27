#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const requiredPaths = [
  ".ai-native/core/context-governance.md",
  ".ai-native/core/git-boundary.md",
  ".ai-native/templates/context-correction-report.md",
  ".ai-native/templates/git-boundary-report.md",
  ".ai-native/templates/learning-candidate.md",
  ".ai-native/docs/project-memory.md",
  ".ai-native/docs/git-boundary.md",
  "AGENTS.md",
  "docs/governance/ai-native-dev-kit-adoption-v1.md",
  "docs/governance/project-workflow.md",
  "docs/evidence/frontend-baseline-evidence.md",
  "docs/testing/test-plan.md"
];

const requiredText = [
  {
    path: "AGENTS.md",
    markers: ["You may be in a dirty git worktree", "NEVER revert existing changes"]
  },
  {
    path: "docs/governance/ai-native-dev-kit-adoption-v1.md",
    markers: ["Authority Order", "context-governance"]
  }
];

const failures = [];

for (const relPath of requiredPaths) {
  const exists = fs.existsSync(path.join(projectRoot, relPath));
  console.log(`${exists ? "PASS" : "FAIL"} ${relPath}`);
  if (!exists) failures.push(`missing ${relPath}`);
}

for (const item of requiredText) {
  const filePath = path.join(projectRoot, item.path);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, "utf8");
  for (const marker of item.markers) {
    const exists = content.includes(marker);
    console.log(`${exists ? "PASS" : "FAIL"} ${item.path} marker ${marker}`);
    if (!exists) failures.push(`missing ${item.path} marker ${marker}`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("AI Native context adapter check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("");
console.log("AI Native context adapter check passed.");
