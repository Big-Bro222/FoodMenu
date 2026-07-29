import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createWeekPlan,
  getCurrentPlan,
  getCurrentPlanVersion,
  getWeekPlan,
  initializeDatabase,
  listWeekPlans,
  publishWeekPlan,
  updateWeekPlan
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const clientDist = path.join(rootDir, "client", "dist");

const app = express();
const port = Number(process.env.PORT || 3000);

initializeDatabase();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "food-menu", timestamp: new Date().toISOString() });
});

app.get("/api/week-plans", (_req, res) => {
  res.json({ plans: listWeekPlans() });
});

app.post("/api/week-plans", (req, res) => {
  try {
    const year = Number(req.body.year);
    const weekNumber = Number(req.body.weekNumber);
    const title = String(req.body.title || `Week${weekNumber}`);

    if (!Number.isInteger(year) || !Number.isInteger(weekNumber)) {
      return res.status(400).json({ error: "year and weekNumber are required integers" });
    }

    const plan = createWeekPlan({ year, weekNumber, title });
    res.status(201).json({ plan });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "This week plan already exists" });
    }
    res.status(500).json({ error: "Failed to create week plan" });
  }
});

app.get("/api/week-plans/:id", (req, res) => {
  const plan = getWeekPlan(Number(req.params.id));
  if (!plan) return res.status(404).json({ error: "Week plan not found" });
  res.json({ plan });
});

app.put("/api/week-plans/:id", (req, res) => {
  try {
    const plan = updateWeekPlan(Number(req.params.id), req.body);
    if (!plan) return res.status(404).json({ error: "Week plan not found" });
    res.json({ plan });
  } catch (_error) {
    res.status(400).json({ error: "Failed to update week plan" });
  }
});

app.post("/api/week-plans/:id/publish", (req, res) => {
  const plan = publishWeekPlan(Number(req.params.id));
  if (!plan) return res.status(404).json({ error: "Week plan not found" });
  res.json({ plan });
});

app.get("/api/current-plan", (_req, res) => {
  const plan = getCurrentPlan();
  if (!plan) return res.status(404).json({ error: "No published plan" });
  res.json({ plan });
});

app.get("/api/current-plan/version", (_req, res) => {
  const version = getCurrentPlanVersion();
  if (!version) return res.status(404).json({ error: "No published plan" });
  res.json(version);
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`FoodMenu API listening on http://localhost:${port}`);
});
