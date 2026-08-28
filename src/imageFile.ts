// Уменьшение картинок перед сохранением в карточку.
//
// Изображение хранится прямо в данных инфоцентра (data:URL), поэтому фотография
// с телефона на 5 МБ раздувает общее состояние и замедляет каждое сохранение —
// именно переполнение хранилища когда-то и сломало сохранение карточек.
// Ужимаем до разумного размера прямо в браузере.

const MAX_DIMENSION = 1600;
const QUALITY = 0.85;
const KEEP_AS_IS_BYTES = 300_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('не удалось открыть изображение'));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  // Векторную и анимированную графику пересжимать нельзя — потеряется суть.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return original;
  if (original.length <= KEEP_AS_IS_BYTES) return original;

  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    // JPEG не умеет прозрачность — подкладываем белый фон, иначе она станет чёрной.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', QUALITY);
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}

export function dataUrlSizeLabel(dataUrl: string): string {
  const kb = Math.round((dataUrl.length * 0.75) / 1024);
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} МБ` : `${kb} КБ`;
}
