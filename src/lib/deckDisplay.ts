/** Display-only: turns file-style names (kanji_bai_6_den_10) into readable text without touching stored data. */
export function displayDeckName(name: string): string {
  return name.replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').trim() || name;
}
