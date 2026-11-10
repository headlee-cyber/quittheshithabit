/** 長辺の上限。これより大きい画像は送っても精度は上がらず、通信量と料金だけ増える */
const MAX_EDGE = 1568;

export interface PreparedImage {
  base64: string; // data: プレフィックスなし
  mediaType: 'image/jpeg';
  previewUrl: string;
}

/** カメラ画像を縮小して JPEG の base64 にする (EXIF の向きはブラウザが反映する) */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg', previewUrl: dataUrl };
}
