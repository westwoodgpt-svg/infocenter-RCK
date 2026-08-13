import { AnyCard } from '../../types';
import KpiCardView from './KpiCardView';
import ChartCardView from './ChartCardView';
import MoneyCardView from './MoneyCardView';
import ListCardView from './ListCardView';
import PersonCardView from './PersonCardView';
import EventCardView from './EventCardView';
import EventsCardView from './EventsCardView';
import TableCardView from './TableCardView';
import ImageCardView from './ImageCardView';

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
    case 'event':
      return <EventCardView card={card} />;
    case 'events':
      return <EventsCardView card={card} />;
    case 'table':
      return <TableCardView card={card} />;
    case 'image':
      return <ImageCardView card={card} />;
    default:
      return null;
  }
}
