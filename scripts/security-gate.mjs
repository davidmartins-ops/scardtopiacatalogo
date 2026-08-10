#!/usr/bin/env node
/**
 * Security gate for CI.
 *
 * Fails the pipeline when the dependency scan reports HIGH/CRITICAL advisories
 * that are not present in the accepted baseline (`security/baseline.json`).
 *
 * Usage:
 *   node scripts/security-gate.mjs            # verify (fails on new findings)
 *   node scripts/security-gate.mjs --update   # rewrite the baseline locally
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASELINE_PATH = "security/baseline.json";
const BLOCKING = new Set(["high", "critical"]);
const update = process.argv.includes("--update");

function runAudit() {
  try {
    return execFileSync("npm", ["audit", "--json", "--audit-level=high"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities exist; the JSON is on stdout.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

function collectFindings(raw) {
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error("Security gate: could not parse `npm audit --json` output.");
    process.exit(1);
  }

  const findings = [];
  for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    if (!BLOCKING.has(vuln.severity)) continue;
    const advisories = (vuln.via ?? [])
      .filter((v) => typeof v === "object" && v.url)
      .map((v) => v.url)
      .sort();
    findings.push({
      id: `${name}@${vuln.range ?? "*"}`,
      package: name,
      severity: vuln.severity,
      advisories,
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return { accepted: [] };
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error(`Security gate: ${BASELINE_PATH} is not valid JSON.`);
    process.exit(1);
  }
}

const findings = collectFindings(runAudit());
const baseline = readBaseline();
const acceptedIds = new Set((baseline.accepted ?? []).map((f) => f.id));

if (update) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ updated_at: new Date().toISOString(), accepted: findings }, null, 2)}\n`,
  );
  console.log(`Security gate: baseline updated with ${findings.length} accepted finding(s).`);
  process.exit(0);
}

const newFindings = findings.filter((f) => !acceptedIds.has(f.id));
const resolved = [...acceptedIds].filter((id) => !findings.some((f) => f.id === id));

console.log(
  `Security gate: ${findings.length} blocking finding(s) detected, ${acceptedIds.size} accepted in baseline.`,
);
if (resolved.length) {
  console.log(`Resolved since baseline (safe to prune): ${resolved.join(", ")}`);
}

if (newFindings.length) {
  console.error("\n\u274c New security findings detected — deployment blocked:\n");
  for (const f of newFindings) {
    console.error(`  [${f.severity.toUpperCase()}] ${f.id}`);
    for (const url of f.advisories) console.error(`      ${url}`);
  }
  console.error(
    "\nFix them with `bun update <package>` (regenerate the lockfile), or, if the risk is\n" +
      "explicitly accepted, record it via `node scripts/security-gate.mjs --update`.\n",
  );
  process.exit(1);
}

console.log("\u2705 No new security findings. Deployment allowed.");
