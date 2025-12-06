/**
 * Static file serving for production
 * Development server (Vite) is in vite-dev.ts
 */
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Re-export log from logger for backwards compatibility
export { log } from "./logger";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
