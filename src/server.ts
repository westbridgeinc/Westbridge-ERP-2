import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import signupRoutes from "./routes/signup.routes.js";
import csrfRoutes from "./routes/csrf.routes.js";
import erpRoutes from "./routes/erp.routes.js";
import inviteRoutes from "./routes/invite.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import teamRoutes from "./routes/team.routes.js";
import accountRoutes from "./routes/account.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import healthRoutes from "./routes/health.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import webhooksRoutes from "./routes/webhooks.routes.js";
import miscRoutes from "./routes/misc.routes.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);

// ─── Global Middleware ───────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Also parse text/plain for analytics beacon requests
app.use(express.text({ type: "text/plain" }));

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on("finish", () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "test") {
      console.log(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api", signupRoutes);
app.use("/api", csrfRoutes);
app.use("/api", erpRoutes);
app.use("/api", inviteRoutes);
app.use("/api", adminRoutes);
app.use("/api", auditRoutes);
app.use("/api", teamRoutes);
app.use("/api", accountRoutes);
app.use("/api", billingRoutes);
app.use("/api", aiRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", healthRoutes);
app.use("/api", eventsRoutes);
app.use("/api", webhooksRoutes);
app.use("/api", miscRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: { code: "SERVER_ERROR", message: "Internal server error" } });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Westbridge API server running on port ${PORT}`);
});

export default app;
