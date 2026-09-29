import { upload } from '@vercel/blob/client';
import { NoteAttachment } from './types';
import { currentAuth, refreshAuth, ShowcaseUploads } from './bitrix';
import { fileToDataUrl } from './imageFile';

// Вложения стикеров витрины.
//
// На своём сервере файл кладётся на его диск (api/showcase-file.js), на
// Vercel — в хранилище Vercel Blob. В обоих случаях в стикере остаётся только
// ссылка — данные витрины не раздуваются, и можно прикладывать презентации и сканы.
// Без хранилища (не подключено или приложение открыто вне портала) файл
// сохраняется прямо в данных витрины, поэтому допустимы только небольшие.

export const MAX_BLOB_BYTES = 50 * 1024 * 1024;
export const MAX_INLINE_BYTES = 700 * 1024;

let counter = 0;
const newAttachmentId = () => {
  counter += 1;
  return `att-${Date.now()}-${counter}`;
};

export const isImageAttachment = (a: Pick<NoteAttachment, 'contentType' | 'name'>) =>
  a.contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.name);

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

// Кириллицу оставляем — так файл узнаваем в хранилище; убираем только то,
// что ломает путь.
function safeName(name: string): string {
  const cleaned = name.replace(/[\\/?#%*:|"<>]+/g, '-').replace(/\s+/g, '_').slice(-120);
  return cleaned || 'file';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

async function uploadToBlob(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const send = async () => {
    const auth = await currentAuth();
    if (!auth) throw new Error('не удалось получить авторизацию Битрикс24');
    const result = await upload(`showcase/${safeName(file.name)}`, file, {
      access: 'public',
      handleUploadUrl: '/api/showcase-upload',
      clientPayload: JSON.stringify({ auth: { access_token: auth.access_token, domain: auth.domain } }),
      contentType: file.type || undefined,
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
    });
    return result.url;
  };
  try {
    return await send();
  } catch (e) {
    // Токен портала живёт около часа — обновляем и пробуем ещё раз.
    const message = e instanceof Error ? e.message : '';
    if (/сессия|авторизац/i.test(message) && (await refreshAuth())) return send();
    throw e;
  }
}

// Файл на диск своего сервера одним запросом. XMLHttpRequest, а не fetch —
// только он умеет сообщать прогресс отправки.
function sendToServer(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const attempt = async (): Promise<{ status: number; url?: string; error?: string }> => {
    const auth = await currentAuth();
    if (!auth) throw new Error('не удалось получить авторизацию Битрикс24');
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/showcase-file?name=${encodeURIComponent(file.name)}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Bx-Access-Token', auth.access_token);
      xhr.setRequestHeader('X-Bx-Domain', auth.domain);
      if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
      xhr.onload = () => {
        let data: { url?: string; error?: string } = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = {};
        }
        resolve({ status: xhr.status, url: data.url, error: data.error || (xhr.status >= 400 ? `HTTP ${xhr.status}` : undefined) });
      };
      xhr.onerror = () => reject(new Error('сетевая ошибка при загрузке файла'));
      xhr.send(file);
    });
  };
  return (async () => {
    let result = await attempt();
    // Токен портала живёт около часа — обновляем и пробуем ещё раз.
    if (result.status === 403 && (await refreshAuth())) result = await attempt();
    if (result.status >= 400 || !result.url) throw new Error(result.error || 'не удалось загрузить файл');
    return result.url;
  })();
}

export async function uploadAttachment(
  file: File,
  mode: ShowcaseUploads,
  onProgress?: (percent: number) => void
): Promise<NoteAttachment> {
  const base = { id: newAttachmentId(), name: file.name, contentType: file.type || 'application/octet-stream' };

  if (mode === 'disk' || mode === 'blob') {
    if (file.size > MAX_BLOB_BYTES) throw new Error(`«${file.name}» больше ${formatBytes(MAX_BLOB_BYTES)}`);
    const url = mode === 'disk' ? await sendToServer(file, onProgress) : await uploadToBlob(file, onProgress);
    return { ...base, url, size: file.size };
  }

  // Картинки ужимаем в браузере (как в карточке «Изображение») — тогда даже
  // фото с телефона помещается в данные витрины.
  const url = base.contentType.startsWith('image/') ? await fileToDataUrl(file) : await readAsDataUrl(file);
  const size = Math.round(url.length * 0.75);
  if (size > MAX_INLINE_BYTES) {
    throw new Error(
      `«${file.name}» (${formatBytes(size)}) слишком большой: пока не подключено хранилище файлов, ` +
        `можно прикладывать файлы до ${formatBytes(MAX_INLINE_BYTES)}`
    );
  }
  onProgress?.(100);
  return { ...base, url, size };
}

/** Ссылка «скачать»: у файлов из хранилища — с принудительным скачиванием. */
export function downloadHref(a: NoteAttachment): string {
  if (a.url.startsWith('data:')) return a.url;
  return a.url + (a.url.includes('?') ? '&' : '?') + 'download=1';
}
