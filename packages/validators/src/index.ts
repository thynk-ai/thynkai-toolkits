export function formatRunId(prefix = "run"): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${t}-${r}`;
}
