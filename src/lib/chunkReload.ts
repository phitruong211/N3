const KEY = 'chunk_reload_at';

/** A lazy page or script that cannot be fetched is almost always a deploy that replaced the files this tab still points at. */
export function isChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported|Unable to preload CSS|ChunkLoadError/i.test(text);
}

/** Reloads once to pick up the new files; false when it already did in the last 10 seconds, so a real outage cannot loop. */
export function reloadForNewVersion(): boolean {
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10_000) return false;
  sessionStorage.setItem(KEY, String(Date.now()));
  location.reload();
  return true;
}
