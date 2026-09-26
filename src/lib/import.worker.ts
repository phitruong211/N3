import { parseExcelImport, parseTextImport } from './ankiImport';
self.onmessage = async ({ data }: MessageEvent<{ file: File }>) => {
  try {
    const { file } = data;
    const preview = /\.xlsx?$/i.test(file.name)
      ? await parseExcelImport(await file.arrayBuffer(), file.name)
      : parseTextImport(await file.text(), file.name);
    self.postMessage({ preview });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Không đọc được tệp' }); }
};
