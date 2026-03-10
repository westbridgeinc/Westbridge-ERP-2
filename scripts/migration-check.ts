#!/usr/bin/env tsx
/**
 * Migration safety checker.
 * Scans pending migration SQL files for destructive operations and exits 1 if any are found
 * without an explicit approval comment.
 *
 * Usage: npx tsx scripts/migration-check.ts
 */
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/** SQL patterns that require explicit approval. */
const DESTRUCTIVE_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /DROP\s+TABLE/i, description: "DROP TABLE" },
  { pattern: /DROP\s+COLUMN/i, description: "DROP COLUMN" },
  { pattern: /ALTER\s+COLUMN.+TYPE/i, description: "ALTER COLUMN TYPE" },
  { pattern: /TRUNCATE/i, description: "TRUNCATE" },
  { pattern: /DELETE\s+FROM/i, description: "DELETE FROM (bulk delete)" },
  { pattern: /DROP\s+INDEX/i, description: "DROP INDEX" },
  { pattern: /DROP\s+CONSTRAINT/i, description: "DROP CONSTRAINT" },
];

const APPROVAL_COMMENT = "-- westbridge:approve-destructive";

interface Finding {
  file: string;
  line: number;
  match: string;
  description: string;
}

function checkMigrationFile(filePath: string): Finding[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, description } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(line)) {
        // Check if the preceding line has the approval comment
        const prevLine = lines[i - 1] ?? "";
        if (!prevLine.trim().startsWith(APPROVAL_COMMENT)) {
          findings.push({
            file: path.basename(path.dirname(filePath)),
            line: i + 1,
            match: line.trim(),
            description,
          });
        }
      }
    }
  }
  return findings;
}

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log("No migrations directory found — skipping check.");
    process.exit(0);
  }

  const migrationDirs = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((d) => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
    .sort();

  const allFindings: Finding[] = [];

  for (const dir of migrationDirs) {
    const sqlFile = path.join(MIGRATIONS_DIR, dir, "migration.sql");
    if (!fs.existsSync(sqlFile)) continue;
    const findings = checkMigrationFile(sqlFile);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log("✓ Migration safety check passed — no unapproved destructive operations found.");
    process.exit(0);
  }

  console.error("\n⛔  Destructive migration operations require explicit approval:\n");
  for (const f of allFindings) {
    console.error(`  Migration: ${f.file}`);
    console.error(`  Line ${f.line}: ${f.match}`);
    console.error(`  Reason: ${f.description}`);
    console.error(`  Fix: Add the line below immediately before the destructive statement:`);
    console.error(`       ${APPROVAL_COMMENT}`);
    console.error();
  }

  process.exit(1);
}

main();
