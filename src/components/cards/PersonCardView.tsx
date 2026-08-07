import { UserRound, Layers } from 'lucide-react';
import { PersonCard } from '../../types';

export default function PersonCardView({ card }: { card: PersonCard }) {
  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        {card.photoUrl ? (
          <img
            src={card.photoUrl}
            alt={card.title}
            className="w-11 h-11 rounded-xl object-cover border border-indigo-500/20 flex-shrink-0"
          />
        ) : (
          <span className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 flex-shrink-0">
            <UserRound className="w-5 h-5" />
          </span>
        )}
        <div>
          <h3 className="text-base font-bold text-white font-display">{card.title}</h3>
          <p className="text-xs text-indigo-400 font-medium mt-0.5">{card.role}</p>
        </div>
      </div>

      {card.tags.length > 0 && (
        <div className="space-y-2 border-t border-[#1f1f23] pt-4">
          <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold font-display flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Направления
          </p>
          <div className="flex flex-wrap gap-2">
            {card.tags.map((t, i) => (
              <span key={i} className="text-xs text-zinc-300 bg-[#161619] px-2.5 py-1 rounded-lg border border-[#27272a]/60">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {card.note && (
        <div className="text-xs text-amber-400 font-medium bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10">
          {card.note}
        </div>
      )}
    </div>
  );
}
