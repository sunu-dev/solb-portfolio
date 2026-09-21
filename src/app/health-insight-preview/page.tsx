import { notFound } from 'next/navigation';
import HealthInsight from '@/components/portfolio/HealthInsight';

export default function HealthInsightPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main style={{ maxWidth: 960, margin: '48px auto', padding: '0 16px' }}>
    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>분석 탭 · 안내 카드 미리보기</p>
    <div style={{ padding: 20, borderRadius: 16, background: 'var(--bg-subtle, #f8f9fa)' }}>
      <HealthInsight title="+5점 더 올리려면">한 종목 비중이 너무 큰 듯해요. 비중 큰 종목을 일부 정리하거나 다른 섹터를 추가해보세요.</HealthInsight>
    </div>
  </main>;
}
