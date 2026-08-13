import { ImageOff } from 'lucide-react';
import { ImageCard } from '../../types';

export default function ImageCardView({ card }: { card: ImageCard }) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-white font-display mb-3">{card.title}</h3>
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={card.subtitle || card.title}
          className="w-full max-h-[360px] object-contain rounded-xl border border-[#27272a] bg-[#161619]"
        />
      ) : (
        <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-xl">
          <ImageOff className="w-5 h-5" />
          Изображение не загружено
        </div>
      )}
      {card.subtitle && <p className="text-[11px] text-[#a1a1aa] mt-2.5">{card.subtitle}</p>}
    </div>
  );
}
