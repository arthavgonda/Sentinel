import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getDb } from "./db/connection";
import { seed } from "./db/seed";
import authRouter from "./routes/auth";
import objectsRouter from "./routes/objects";
import casesRouter from "./routes/cases";
import notesRouter from "./routes/notes";
import linksRouter from "./routes/links";
import erRouter from "./routes/er";
import sourcesRouter from "./routes/sources";
import auditRouter from "./routes/audit";
import searchRouter from "./routes/search";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"], credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use("/api/auth", authRouter);
app.use("/api/v1/objects", objectsRouter);
app.use("/api/v1/cases", casesRouter);
app.use("/api/v1", notesRouter);
app.use("/api/v1/links", linksRouter);
app.use("/api/v1/er", erRouter);
app.use("/api/v1/sources", sourcesRouter);
app.use("/api/v1/audit", auditRouter);
app.use("/api/v1/search", searchRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

getDb();
seed();

app.listen(PORT, () => {
  process.stdout.write(`[sentinel-api] listening on :${PORT}\n`);
});

export default app;
