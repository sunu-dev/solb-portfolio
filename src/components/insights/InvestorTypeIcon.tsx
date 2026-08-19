import {
  Activity,
  HandCoins,
  Landmark,
  Layers3,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { InvestorType } from '@/config/investorTypes';

const TYPE_ICONS: Record<InvestorType, LucideIcon> = {
  value: Landmark,
  growth: TrendingUp,
  income: HandCoins,
  momentum: Activity,
  diversified: Layers3,
};

interface Props {
  type: InvestorType;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function InvestorTypeIcon({
  type,
  size = 18,
  color = 'currentColor',
  strokeWidth = 1.75,
}: Props) {
  const Icon = TYPE_ICONS[type];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />;
}
