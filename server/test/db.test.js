import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const testDbPath = path.join(rootDir, "data", `foodmenu-test-${process.pid}.sqlite`);

process.env.DATABASE_URL = testDbPath;

const store = await import("../src/db.js");

after(() => {
  store.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    const filePath = `${testDbPath}${suffix}`;
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  }
});

test("initializes with a published seed plan", () => {
  store.initializeDatabase();

  const current = store.getCurrentPlan();

  assert.equal(current.title, "Week31");
  assert.equal(current.status, "published");
  assert.equal(current.entries.length, 14);
});

test("creates, updates, publishes, and reads the current plan", () => {
  const draft = store.createWeekPlan({
    year: 2026,
    weekNumber: 32,
    title: "Week32"
  });

  assert.equal(draft.status, "draft");
  assert.equal(draft.entries.length, 14);

  const updated = store.updateWeekPlan(draft.id, {
    ...draft,
    entries: draft.entries.map((entry) =>
      entry.dayOfWeek === 1 && entry.slot === "dinner"
        ? { ...entry, text: "照烧鸡腿、米饭" }
        : entry
    )
  });

  assert.equal(
    updated.entries.find((entry) => entry.dayOfWeek === 1 && entry.slot === "dinner").text,
    "照烧鸡腿、米饭"
  );

  const published = store.publishWeekPlan(draft.id);
  const current = store.getCurrentPlan();
  const version = store.getCurrentPlanVersion();

  assert.equal(published.status, "published");
  assert.equal(current.id, draft.id);
  assert.equal(version.id, draft.id);
  assert.equal(version.version, 2);
});
