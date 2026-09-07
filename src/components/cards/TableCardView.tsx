import { Table2 } from 'lucide-react';
import { TableCard } from '../../types';
import { cellColorAt, cellColorClass, headerColorAt } from './tableColors';
import { columnWidthAt, hasColumnWidths, tableMinWidth } from './tableWidths';

export default function TableCardView({ card }: { card: TableCard }) {
  const hasData = card.headers.length > 0;
  // Заданы ширины столбцов — переходим на фиксированную раскладку, иначе
  // браузер считает ширину подсказкой и растягивает столбец под содержимое.
  const fixed = hasColumnWidths(card);

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
          <table
            className={`text-xs ${fixed ? 'table-fixed w-full' : 'w-full'}`}
            style={fixed ? { minWidth: tableMinWidth(card) } : undefined}
          >
            {fixed && (
              <colgroup>
                {card.headers.map((_, i) => {
                  const width = columnWidthAt(card, i);
                  return <col key={i} style={width ? { width } : undefined} />;
                })}
              </colgroup>
            )}
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161619]">
                {card.headers.map((h, i) => (
                  <th
                    key={i}
                    className={`text-left align-top p-2.5 font-semibold whitespace-pre-wrap break-words ${
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
                      // Длинный текст переносится по словам, а не растягивает
                      // таблицу в бесконечную горизонтальную прокрутку.
                      <td key={ci} className={`p-2.5 align-top whitespace-pre-wrap break-words ${fill || 'text-zinc-300'}`}>
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
