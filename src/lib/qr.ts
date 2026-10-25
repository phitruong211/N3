// QR codes for share links, drawn in the browser: the link never leaves the device to be encoded.
export async function qrDataUri(text: string): Promise<string> {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return `data:image/svg+xml;utf8,${encodeURIComponent(qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true }))}`;
}

/** The same code as a PNG, for printing or sending as an image. */
export async function qrPng(text: string, size = 640): Promise<Blob> {
  const image = new Image();
  image.src = await qrDataUri(text);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không tạo được ảnh QR')), 'image/png'));
}
