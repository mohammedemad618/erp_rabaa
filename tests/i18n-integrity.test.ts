import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = process.cwd();
const SOURCE_FOLDERS = ["app", "components", "messages", "modules", "services"];
const MOJIBAKE_PATTERN = /[ØÙÃÂâ][\u0080-\u00ff]?/;

function walkFiles(rootDir: string, collector: string[]): void {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collector);
      continue;
    }
    if (!/\.(ts|tsx|json|md|yaml|yml)$/i.test(entry.name)) {
      continue;
    }
    collector.push(fullPath);
  }
}

test("i18n messages include required auth and forbidden keys", () => {
  const en = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "messages/en.json"), "utf8")) as {
    auth?: {
      logout?: string;
      login?: Record<string, string>;
    };
    forbidden?: Record<string, string>;
    transactions?: {
      actionable?: Record<string, string>;
      kpi?: Record<string, string>;
      tableTitle?: string;
      pagination?: Record<string, string>;
      panel?: Record<string, string>;
      paymentMethods?: Record<string, string>;
      messages?: Record<string, string>;
      empty?: Record<string, string>;
    };
    reportsModule?: {
      actionableTitle?: string;
      loadingVisuals?: string;
      heatmap?: Record<string, string>;
      simulation?: Record<string, string>;
      travelIndicators?: {
        title?: string;
        units?: Record<string, string>;
        riskLevel?: Record<string, string>;
      };
    };
    treasury?: {
      actionableTitle?: string;
    };
  };
  const ar = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "messages/ar.json"), "utf8")) as {
    auth?: {
      logout?: string;
      login?: Record<string, string>;
    };
    forbidden?: Record<string, string>;
    transactions?: {
      actionable?: Record<string, string>;
      kpi?: Record<string, string>;
      tableTitle?: string;
      pagination?: Record<string, string>;
      panel?: Record<string, string>;
      paymentMethods?: Record<string, string>;
      messages?: Record<string, string>;
      empty?: Record<string, string>;
    };
    reportsModule?: {
      actionableTitle?: string;
      loadingVisuals?: string;
      heatmap?: Record<string, string>;
      simulation?: Record<string, string>;
      travelIndicators?: {
        title?: string;
        units?: Record<string, string>;
        riskLevel?: Record<string, string>;
      };
    };
    treasury?: {
      actionableTitle?: string;
    };
  };

  assert.equal(typeof en.auth?.logout, "string");
  assert.equal(typeof ar.auth?.logout, "string");
  assert.equal(typeof en.auth?.login?.title, "string");
  assert.equal(typeof ar.auth?.login?.title, "string");
  assert.equal(typeof en.forbidden?.title, "string");
  assert.equal(typeof ar.forbidden?.title, "string");

  assert.equal(typeof en.transactions?.actionable?.title, "string");
  assert.equal(typeof ar.transactions?.actionable?.title, "string");
  assert.equal(typeof en.transactions?.kpi?.matchedRecords, "string");
  assert.equal(typeof ar.transactions?.kpi?.matchedRecords, "string");
  assert.equal(typeof en.transactions?.tableTitle, "string");
  assert.equal(typeof ar.transactions?.tableTitle, "string");
  assert.equal(typeof en.transactions?.pagination?.page, "string");
  assert.equal(typeof ar.transactions?.pagination?.page, "string");
  assert.equal(typeof en.transactions?.pagination?.rowsPerPage, "string");
  assert.equal(typeof ar.transactions?.pagination?.rowsPerPage, "string");
  assert.equal(typeof en.transactions?.panel?.version, "string");
  assert.equal(typeof ar.transactions?.panel?.version, "string");
  assert.equal(typeof en.transactions?.panel?.summary, "string");
  assert.equal(typeof ar.transactions?.panel?.summary, "string");
  assert.equal(typeof en.transactions?.paymentMethods?.cash, "string");
  assert.equal(typeof ar.transactions?.paymentMethods?.cash, "string");
  assert.equal(typeof en.transactions?.messages?.searchFocused, "string");
  assert.equal(typeof ar.transactions?.messages?.searchFocused, "string");
  assert.equal(typeof en.transactions?.empty?.noSelection, "string");
  assert.equal(typeof ar.transactions?.empty?.noSelection, "string");

  assert.equal(typeof en.reportsModule?.actionableTitle, "string");
  assert.equal(typeof ar.reportsModule?.actionableTitle, "string");
  assert.equal(typeof en.reportsModule?.loadingVisuals, "string");
  assert.equal(typeof ar.reportsModule?.loadingVisuals, "string");
  assert.equal(typeof en.reportsModule?.heatmap?.distributionNote, "string");
  assert.equal(typeof ar.reportsModule?.heatmap?.distributionNote, "string");
  assert.equal(typeof en.reportsModule?.simulation?.title, "string");
  assert.equal(typeof ar.reportsModule?.simulation?.title, "string");
  assert.equal(typeof en.reportsModule?.travelIndicators?.title, "string");
  assert.equal(typeof ar.reportsModule?.travelIndicators?.title, "string");
  assert.equal(typeof en.reportsModule?.travelIndicators?.units?.hours, "string");
  assert.equal(typeof ar.reportsModule?.travelIndicators?.units?.hours, "string");
  assert.equal(typeof en.reportsModule?.travelIndicators?.riskLevel?.high, "string");
  assert.equal(typeof ar.reportsModule?.travelIndicators?.riskLevel?.high, "string");

  assert.equal(typeof en.treasury?.actionableTitle, "string");
  assert.equal(typeof ar.treasury?.actionableTitle, "string");
});

test("source files do not contain mojibake markers", () => {
  const files: string[] = [];
  for (const folder of SOURCE_FOLDERS) {
    const root = path.join(REPO_ROOT, folder);
    if (!fs.existsSync(root)) {
      continue;
    }
    walkFiles(root, files);
  }

  const affected: string[] = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    if (MOJIBAKE_PATTERN.test(content)) {
      affected.push(path.relative(REPO_ROOT, filePath));
    }
  }

  assert.deepEqual(affected, []);
});
