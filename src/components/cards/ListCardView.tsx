import { ListChecks } from 'lucide-react';
import { ListCard } from '../../types';

export default function ListCardView({ card }: { card: ListCard }) {
  return (
    <div className="p-6">
      <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
        <ListChecks className="w-4 h-4 text-amber-400" /> {card.title}
      </h3>
      {card.subtitle && <p className="text-xs text-[#a1a1aa] mt-1">{card.subtitle}</p>}

      {card.items.length === 0 ? (
        <p className="text-xs text-[#71717a] mt-4">Пунктов пока нет</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {card.items.map((item, i) => (
            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
