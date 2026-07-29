import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const dataDir = path.join(rootDir, "data");
const dbPath = process.env.DATABASE_URL || path.join(dataDir, "foodmenu.sqlite");

const days = [0, 1, 2, 3, 4, 5, 6];
const slots = ["morning", "dinner"];

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

function now() {
  return new Date().toISOString();
}

function getSetting(key) {
  return db.prepare("select value from app_settings where key = ?").get(key)?.value ?? null;
}

function setSetting(key, value) {
  db.prepare(
    `insert into app_settings (key, value)
     values (?, ?)
     on conflict(key) do update set value = excluded.value`
  ).run(key, String(value));
}

function createEntries(weekPlanId, entries = []) {
  const byKey = new Map(entries.map((entry) => [`${entry.dayOfWeek}:${entry.slot}`, entry]));
  const insert = db.prepare(
    `insert into meal_entries (week_plan_id, day_of_week, slot, text, notes)
     values (?, ?, ?, ?, ?)`
  );

  for (const dayOfWeek of days) {
    for (const slot of slots) {
      const entry = byKey.get(`${dayOfWeek}:${slot}`);
      insert.run(weekPlanId, dayOfWeek, slot, entry?.text ?? "", entry?.notes ?? "");
    }
  }
}

function normalizePlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    weekNumber: row.week_number,
    title: row.title,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

function normalizeEntry(row) {
  return {
    id: row.id,
    weekPlanId: row.week_plan_id,
    dayOfWeek: row.day_of_week,
    slot: row.slot,
    text: row.text,
    notes: row.notes
  };
}

export function initializeDatabase() {
  db.exec(`
    create table if not exists week_plans (
      id integer primary key autoincrement,
      year integer not null,
      week_number integer not null,
      title text not null,
      status text not null check(status in ('draft', 'published')),
      version integer not null default 1,
      created_at text not null,
      updated_at text not null,
      published_at text,
      unique(year, week_number)
    );

    create table if not exists meal_entries (
      id integer primary key autoincrement,
      week_plan_id integer not null,
      day_of_week integer not null check(day_of_week between 0 and 6),
      slot text not null,
      text text not null default '',
      notes text not null default '',
      foreign key (week_plan_id) references week_plans(id) on delete cascade,
      unique(week_plan_id, day_of_week, slot)
    );

    create table if not exists app_settings (
      key text primary key,
      value text not null
    );
  `);

  seedInitialPlan();
}

function seedInitialPlan() {
  const count = db.prepare("select count(*) as count from week_plans").get().count;
  if (count > 0) return;

  const seedEntries = [
    { dayOfWeek: 0, slot: "morning", text: "豆浆、鸡蛋、包子" },
    { dayOfWeek: 0, slot: "dinner", text: "番茄牛腩、青菜、米饭" },
    { dayOfWeek: 1, slot: "morning", text: "燕麦粥、水果" },
    { dayOfWeek: 1, slot: "dinner", text: "红烧鸡腿、炒西兰花" },
    { dayOfWeek: 2, slot: "morning", text: "三明治、牛奶" },
    { dayOfWeek: 2, slot: "dinner", text: "清蒸鱼、土豆丝" },
    { dayOfWeek: 3, slot: "morning", text: "小米粥、煎蛋" },
    { dayOfWeek: 3, slot: "dinner", text: "咖喱牛肉、米饭" },
    { dayOfWeek: 4, slot: "morning", text: "馄饨" },
    { dayOfWeek: 4, slot: "dinner", text: "排骨汤、炒白菜" },
    { dayOfWeek: 5, slot: "morning", text: "面包、酸奶" },
    { dayOfWeek: 5, slot: "dinner", text: "饺子、凉拌黄瓜" },
    { dayOfWeek: 6, slot: "morning", text: "葱油饼、豆腐脑" },
    { dayOfWeek: 6, slot: "dinner", text: "火锅" }
  ];

  const createSeed = db.transaction(() => {
    const timestamp = now();
    const result = db
      .prepare(
        `insert into week_plans
          (year, week_number, title, status, version, created_at, updated_at, published_at)
         values (?, ?, ?, 'published', 1, ?, ?, ?)`
      )
      .run(2026, 31, "Week31", timestamp, timestamp, timestamp);

    createEntries(result.lastInsertRowid, seedEntries);
    setSetting("currentPublishedWeekPlanId", result.lastInsertRowid);
  });

  createSeed();
}

export function listWeekPlans() {
  return db
    .prepare(
      `select * from week_plans
       order by year desc, week_number desc, updated_at desc`
    )
    .all()
    .map(normalizePlan);
}

export function getWeekPlan(id) {
  const plan = normalizePlan(db.prepare("select * from week_plans where id = ?").get(id));
  if (!plan) return null;

  const entries = db
    .prepare(
      `select * from meal_entries
       where week_plan_id = ?
       order by day_of_week asc, slot asc`
    )
    .all(id)
    .map(normalizeEntry);

  return { ...plan, entries };
}

export function createWeekPlan({ year, weekNumber, title }) {
  const createPlan = db.transaction(() => {
    const timestamp = now();
    const result = db
      .prepare(
        `insert into week_plans
          (year, week_number, title, status, version, created_at, updated_at)
         values (?, ?, ?, 'draft', 1, ?, ?)`
      )
      .run(year, weekNumber, title || `Week${weekNumber}`, timestamp, timestamp);

    createEntries(result.lastInsertRowid);
    return getWeekPlan(result.lastInsertRowid);
  });

  return createPlan();
}

export function updateWeekPlan(id, { year, weekNumber, title, entries }) {
  const updatePlan = db.transaction(() => {
    const current = getWeekPlan(id);
    if (!current) return null;

    db.prepare(
      `update week_plans
       set year = ?, week_number = ?, title = ?, updated_at = ?
       where id = ?`
    ).run(year, weekNumber, title, now(), id);

    const updateEntry = db.prepare(
      `insert into meal_entries (week_plan_id, day_of_week, slot, text, notes)
       values (?, ?, ?, ?, ?)
       on conflict(week_plan_id, day_of_week, slot)
       do update set text = excluded.text, notes = excluded.notes`
    );

    for (const entry of entries || []) {
      updateEntry.run(id, entry.dayOfWeek, entry.slot, entry.text ?? "", entry.notes ?? "");
    }

    return getWeekPlan(id);
  });

  return updatePlan();
}

export function publishWeekPlan(id) {
  const publishPlan = db.transaction(() => {
    const current = getWeekPlan(id);
    if (!current) return null;

    const timestamp = now();
    db.prepare(
      `update week_plans
       set status = 'published',
           version = version + 1,
           updated_at = ?,
           published_at = ?
       where id = ?`
    ).run(timestamp, timestamp, id);

    setSetting("currentPublishedWeekPlanId", id);
    return getWeekPlan(id);
  });

  return publishPlan();
}

export function getCurrentPlan() {
  const id = getSetting("currentPublishedWeekPlanId");
  if (!id) return null;

  const plan = getWeekPlan(id);
  if (!plan || plan.status !== "published") return null;
  return plan;
}

export function getCurrentPlanVersion() {
  const plan = getCurrentPlan();
  if (!plan) return null;
  return {
    id: plan.id,
    version: plan.version,
    publishedAt: plan.publishedAt
  };
}
