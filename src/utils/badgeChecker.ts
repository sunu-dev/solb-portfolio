import { BADGES } from '@/config/badges';
import type { Badge } from '@/config/badges';

interface CheckInput {
  totalStocks: number;
  streak: number;
  aiUsageCount: number;
  mentorUsed: Set<string>;
  profitCount: number;
  allProfit: boolean;
  targetHit: boolean;
  rainLight: boolean; // 하락장에서도 수익 유지
}

export function checkUnlockedBadges(input: CheckInput): Badge[] {
  const unlocked: Badge[] = [];

  for (const badge of BADGES) {
    let earned = false;
    switch (badge.id) {
      case 'first-stock': earned = input.totalStocks >= 1; break;
      case 'three-stocks': earned = input.totalStocks >= 3; break;
      case 'first-login': earned = true; break; // 항상 해금
      case 'streak-7': earned = input.streak >= 7; break;
      case 'streak-30': earned = input.streak >= 30; break;
      case 'streak-100': earned = input.streak >= 100; break;
      case 'five-stocks': earned = input.totalStocks >= 5; break;
      case 'ten-stocks': earned = input.totalStocks >= 10; break;
      case 'first-analysis': earned = input.aiUsageCount >= 1; break;
      case 'mentor-all': earned = input.mentorUsed.size >= 6; break;
      case 'first-profit': earned = input.profitCount >= 1; break;
      case 'target-hit': earned = input.targetHit; break;
      case 'all-profit': earned = input.allProfit; break;
      case 'rain-light': earned = input.rainLight; break;
    }
    if (earned) unlocked.push(badge);
  }

  return unlocked;
}
