#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const requiredPaths = [
  ".ai-native/core/safe-launch.md",
  ".ai-native/templates/launch-readiness-report.md",
  ".ai-native/checklists/launch-readiness-review.md",
  ".ai-native/docs/safe-launch.md",
  "docs/release/rollout-rollback-plan.md",
  "docs/release/release-record.md",
  "docs/recovery/recovery-drill-record.md",
  "docs/operations/observability-signals.md",
  "docs/incident/runbook.md",
  "docs/environment-baseline.md",
  "AGENTS.md"
];

const requiredText = [
  {
    path: "AGENTS.md",
    markers: ["production release or deployment", "backup restore or disaster recovery operation"]
  },
  {
    path: "docs/environment-baseline.md",
    markers: ["PENDING_CONFIRMATION", "Codex may modify CI: Human approval required"]
  },
  {
    path: "docs/governance/ai-native-dev-kit-adoption-v1.md",
    markers: ["does not deploy", "approve release"]
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
  if (!fs.existsSync(filePath)) {
    console.log(`FAIL ${item.path}`);
    failures.push(`missing ${item.path}`);
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const marker of item.markers) {
    const exists = content.includes(marker);
    console.log(`${exists ? "PASS" : "FAIL"} ${item.path} marker ${marker}`);
    if (!exists) failures.push(`missing ${item.path} marker ${marker}`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("AI Native launch adapter check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("");
console.log("AI Native launch adapter check passed.");
