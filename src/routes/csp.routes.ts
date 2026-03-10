import { Router, Request, Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * POST /csp-report — receives Content-Security-Policy violation reports.
 * Browsers send these automatically when a CSP directive is violated.
 */
router.post("/csp-report", (req: Request, res: Response) => {
  const report = req.body?.["csp-report"] ?? req.body;

  if (report && typeof report === "object") {
    logger.warn("CSP violation", {
      documentUri: report["document-uri"],
      violatedDirective: report["violated-directive"],
      effectiveDirective: report["effective-directive"],
      blockedUri: report["blocked-uri"],
      sourceFile: report["source-file"],
      lineNumber: report["line-number"],
      columnNumber: report["column-number"],
    });
  }

  return res.status(204).send();
});

export default router;
