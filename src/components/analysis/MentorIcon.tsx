import { Activity, Layers, Scale, Search, Shield, Sprout } from 'lucide-react';

const styles = {
  safe: { Icon: Shield, label: '배당과 안정성' },
  value: { Icon: Search, label: '기업의 실제 가치' },
  balance: { Icon: Scale, label: '고르게 나눈 투자' },
  growth: { Icon: Sprout, label: '앞으로의 성장' },
  trend: { Icon: Activity, label: '가격과 거래 흐름' },
  simple: { Icon: Layers, label: '시장 전체에 투자' },
};

export function mentorFocus(id: string): string {
  return styles[id as keyof typeof styles]?.label ?? '종목 분석';
}

export default function MentorIcon({ id, size = 44 }: { id: string; size?: number }) {
  const Icon = styles[id as keyof typeof styles]?.Icon ?? Search;
  return (
    <span aria-hidden="true" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0, borderRadius: 12,
      background: 'var(--surface, #fff)', color: 'var(--brand-primary, #0E7C7B)',
      border: '1px solid var(--border-light, #E5E8EB)',
    }}>
      <Icon size={Math.round(size * 0.52)} strokeWidth={1.7} />
    </span>
  );
}
