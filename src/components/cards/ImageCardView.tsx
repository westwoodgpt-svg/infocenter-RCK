import { useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import { ImageCard } from '../../types';
import ImageLightbox from './ImageLightbox';

export default function ImageCardView({ card }: { card: ImageCard }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-white font-display mb-3">{card.title}</h3>
      {card.imageUrl ? (
        <div className="relative group">
          <img
            src={card.imageUrl}
            alt={card.subtitle || card.title}
            onClick={() => setFullscreen(true)}
            title="Открыть во весь экран"
            className="w-full max-h-[360px] object-contain rounded-xl border border-[#27272a] bg-[#161619] cursor-zoom-in"
          />
          {/* Кнопка видна всегда, а не только при наведении: инфоцентр смотрят
              и с планшетов, где наведения нет. */}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            title="Открыть во весь экран"
            className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 border border-white/10 text-zinc-200 opacity-80 hover:opacity-100 hover:text-white hover:bg-black/80 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-xl">
          <ImageOff className="w-5 h-5" />
          Изображение не загружено
        </div>
      )}
      {card.subtitle && <p className="text-[11px] text-[#a1a1aa] mt-2.5">{card.subtitle}</p>}

      {fullscreen && card.imageUrl && (
        <ImageLightbox
          src={card.imageUrl}
          alt={card.subtitle || card.title}
          caption={card.subtitle || card.title}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
