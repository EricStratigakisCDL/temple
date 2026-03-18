declare global {
  interface Window {
    __ENV__?: { API_URL?: string };
  }
}

export function apiUrl(path: string): string {
  const base = window.__ENV__?.API_URL ?? "";
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}
