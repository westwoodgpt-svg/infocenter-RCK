import { AnyCard } from '../../types';
import KpiCardView from './KpiCardView';
import ChartCardView from './ChartCardView';
import MoneyCardView from './MoneyCardView';
import ListCardView from './ListCardView';
import PersonCardView from './PersonCardView';

export default function CardView({ card }: { card: AnyCard }) {
  switch (card.type) {
    case 'kpi':
      return <KpiCardView card={card} />;
    case 'chart':
      return <ChartCardView card={card} />;
    case 'money':
      return <MoneyCardView card={card} />;
    case 'list':
      return <ListCardView card={card} />;
    case 'person':
      return <PersonCardView card={card} />;
    default:
      return null;
  }
}
