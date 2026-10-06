/** Load the first page to discover the current total, then at most three pages concurrently. */
export async function loadStudyPages<T>(fetchPage: (page: number) => Promise<{ content: T[]; totalPages: number }>): Promise<T[]> {
  const first = await fetchPage(0);
  const pages: T[][] = [first.content];
  let next = 1;
  await Promise.all(Array.from({ length: Math.min(3, Math.max(0, first.totalPages - 1)) }, async () => {
    while (next < first.totalPages) {
      const page = next++;
      pages[page] = (await fetchPage(page)).content;
    }
  }));
  return pages.flat();
}
