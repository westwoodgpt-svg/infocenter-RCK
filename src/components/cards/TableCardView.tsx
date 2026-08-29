import { Table2 } from 'lucide-react';
import { TableCard } from '../../types';
import { cellColorAt, cellColorClass, headerColorAt } from './tableColors';

export default function TableCardView({ card }: { card: TableCard }) {
  const hasData = card.headers.length > 0;

  return (
    <div className="p-6">
      <div className="mb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
          <Table2 className="w-4 h-4 text-blue-400" /> {card.title}
        </h3>
        {card.subtitle && <p className="text-xs text-[#a1a1aa] mt-1">{card.subtitle}</p>}
      </div>

      {!hasData ? (
        <div className="h-[120px] flex items-center justify-center text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-xl">
          Нет данных таблицы
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#27272a] rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161619]">
                {card.headers.map((h, i) => (
                  <th
                    key={i}
                    className={`text-left p-2.5 font-semibold whitespace-nowrap ${
                      cellColorClass(headerColorAt(card, i)) || 'text-zinc-300'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[#1f1f23] last:border-b-0 hover:bg-[#161619]/60 transition-colors">
                  {card.headers.map((_, ci) => {
                    const fill = cellColorClass(cellColorAt(card, ri, ci));
                    return (
                      <td key={ci} className={`p-2.5 whitespace-nowrap ${fill || 'text-zinc-300'}`}>
                        {row[ci] ?? ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
