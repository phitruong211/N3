/** Hands a generated file to the browser's download flow. */
export function downloadFile(filename: string, content: BlobPart, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A name that is safe on every file system, keeping Vietnamese and Japanese letters. */
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'bo-the';
