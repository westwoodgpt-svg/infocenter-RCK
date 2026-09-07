import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}

/** Изображение во весь экран. Рисуется порталом в body: карточки лежат внутри
 *  анимированных контейнеров с transform, а внутри такого контейнера
 *  position: fixed отсчитывается от него, а не от окна. */
export default function ImageLightbox({ src, alt, caption, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Фон не должен прокручиваться, пока картинка открыта.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 p-4 md:p-8 bg-black/90 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        title="Закрыть (Esc)"
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[95vw] max-h-[85vh] object-contain rounded-xl cursor-default"
      />
      {caption && <p className="text-xs text-zinc-300 text-center max-w-3xl">{caption}</p>}
    </div>,
    document.body
  );
}
