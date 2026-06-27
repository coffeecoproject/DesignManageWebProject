#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const requiredPaths = [
  ".ai-native/version.json",
  ".ai-native/dev-kit-manifest.json",
  ".ai-native/core/workflow.md",
  ".ai-native/core/patch-classification.md",
  ".ai-native/core/claim-control.md",
  ".ai-native/core/context-governance.md",
  ".ai-native/core/safe-launch.md",
  ".ai-native/checklists/patch-classification-review.md",
  ".ai-native/templates/adoption-assessment.md",
  ".ai-native/templates/existing-governance-map.md",
  ".ai-native/profiles/web-app/baseline.json",
  ".ai-native/profiles/internal-admin/baseline.json",
  ".ai-native/industrial-packs/web-app/pack.json",
  ".ai-native/industrial-packs/internal-admin/pack.json",
  "docs/governance/ai-native-dev-kit-adoption-v1.md",
  "docs/project-profile.md",
  "docs/environment-baseline.md",
  "AGENTS.md",
  "package.json"
];

const requiredPackageScripts = [
  "ai-native:next",
  "ai-native:baseline",
  "ai-native:check",
  "ai-native:doctor",
  "ai-native:claim",
  "ai-native:context",
  "ai-native:launch"
];

const requiredAgentText = [
  "AI Native Dev Kit Workflow Adapter",
  "AI Native Dev Kit may add stricter workflow gates",
  "Forbidden without separate explicit approval"
];

const failures = [];

for (const relPath of requiredPaths) {
  const exists = fs.existsSync(path.join(projectRoot, relPath));
  console.log(`${exists ? "PASS" : "FAIL"} ${relPath}`);
  if (!exists) failures.push(`missing ${relPath}`);
}

const packageJsonPath = path.join(projectRoot, "package.json");
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  for (const scriptName of requiredPackageScripts) {
    const exists = Boolean(packageJson.scripts?.[scriptName]);
    console.log(`${exists ? "PASS" : "FAIL"} package.json script ${scriptName}`);
    if (!exists) failures.push(`missing package.json script ${scriptName}`);
  }
}

const agentsPath = path.join(projectRoot, "AGENTS.md");
if (fs.existsSync(agentsPath)) {
  const agentsText = fs.readFileSync(agentsPath, "utf8");
  for (const marker of requiredAgentText) {
    const exists = agentsText.includes(marker);
    console.log(`${exists ? "PASS" : "FAIL"} AGENTS marker ${marker}`);
    if (!exists) failures.push(`missing AGENTS marker ${marker}`);
  }
}

const versionPath = path.join(projectRoot, ".ai-native/version.json");
if (fs.existsSync(versionPath)) {
  const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
  const expectedProfiles = ["web-app", "internal-admin"];
  for (const profile of expectedProfiles) {
    const exists = version.selectedProfiles?.includes(profile);
    console.log(`${exists ? "PASS" : "FAIL"} selected profile ${profile}`);
    if (!exists) failures.push(`missing selected profile ${profile}`);
  }
  const isBridge = version.adoptionMode === "thin_operational_bridge";
  console.log(`${isBridge ? "PASS" : "FAIL"} adoption mode thin_operational_bridge`);
  if (!isBridge) failures.push("adoption mode is not thin_operational_bridge");
}

if (failures.length > 0) {
  console.error("");
  console.error("AI Native adapter check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("");
console.log("AI Native adapter check passed.");
