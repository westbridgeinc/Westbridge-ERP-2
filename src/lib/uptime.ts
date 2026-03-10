const startedAt = Date.now();

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startedAt) / 1000);
}
