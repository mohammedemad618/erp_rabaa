import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PAGE_PERMISSION_BY_ROUTE } from "../services/auth/page-permissions";

const REPO_ROOT = process.cwd();
const API_ROOT = path.join(REPO_ROOT, "app", "api");
const LOCALE_PAGES_ROOT = path.join(REPO_ROOT, "app", "[locale]");

const PUBLIC_LOCALE_ROUTES = new Set<string>(["/login", "/forbidden"]);
const PUBLIC_API_ROUTES = new Set<string>(["health/db/route.ts"]);

function walkFiles(rootDir: string, fileName: string, collector: string[]): void {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileName, collector);
      continue;
    }
    if (entry.name === fileName) {
      collector.push(fullPath);
    }
  }
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function toLocaleRouteFromPageFile(filePath: string): string {
  const relative = toPosixPath(path.relative(LOCALE_PAGES_ROOT, filePath));
  const directory = path.posix.dirname(relative);
  if (directory === ".") {
    return "/";
  }
  return `/${directory}`;
}

test("all non-auth API routes enforce requireApiPermission", () => {
  const routeFiles: string[] = [];
  walkFiles(API_ROOT, "route.ts", routeFiles);

  const unguarded: string[] = [];
  for (const filePath of routeFiles) {
    const relative = toPosixPath(path.relative(API_ROOT, filePath));
    if (relative.startsWith("auth/")) {
      continue;
    }
    if (PUBLIC_API_ROUTES.has(relative)) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes("requireApiPermission(")) {
      unguarded.push(`app/api/${relative}`);
    }
  }

  assert.deepEqual(unguarded, []);
});

test("all non-public locale pages enforce requirePermission", () => {
  const pageFiles: string[] = [];
  walkFiles(LOCALE_PAGES_ROOT, "page.tsx", pageFiles);

  const unguarded: string[] = [];
  for (const filePath of pageFiles) {
    const route = toLocaleRouteFromPageFile(filePath);
    if (PUBLIC_LOCALE_ROUTES.has(route)) {
      continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes("requirePermission(")) {
      const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
      unguarded.push(`${route} (${relative})`);
    }
  }

  assert.deepEqual(unguarded, []);
});

test("permission map covers all protected locale pages", () => {
  const pageFiles: string[] = [];
  walkFiles(LOCALE_PAGES_ROOT, "page.tsx", pageFiles);

  const missingRoutes: string[] = [];
  for (const filePath of pageFiles) {
    const route = toLocaleRouteFromPageFile(filePath);
    if (PUBLIC_LOCALE_ROUTES.has(route)) {
      continue;
    }

    if (!PAGE_PERMISSION_BY_ROUTE[route]) {
      missingRoutes.push(route);
    }
  }

  assert.deepEqual(missingRoutes, []);
});
