/**
 * Runtime environment configuration.
 * Import `config` wherever you need environment/stage/version information.
 */

export type DeployStage = "dev" | "staging" | "prod";

function getStage(): DeployStage {
  const s = process.env.DEPLOY_STAGE;
  if (s === "staging") return "staging";
  if (s === "prod") return "prod";
  return "dev";
}

export const config = {
  env: (process.env.NODE_ENV ?? "development") as "development" | "test" | "production",
  stage: getStage(),
  region: process.env.DEPLOY_REGION ?? "us-east-1",
  version: process.env.APP_VERSION ?? "0.0.0-local",
  commitSha: process.env.COMMIT_SHA ?? "local",
  isDev: process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
  isStaging: getStage() === "staging",
} as const;
