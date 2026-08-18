'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  DatabaseBackup,
  FileDown,
  LayoutDashboard,
  ScanLine,
  WalletCards,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProToolFeatureId } from '@/config/proPlan';
import ProDemandOffer from '@/components/pro/ProDemandOffer';

interface ReadinessItem {
  id: string;
  label: string;
  ready: boolean;
  requiredForSales: boolean;
  detail: string;
}

interface ProReadinessData {
  plan: {
    id: string;
    name: string;
    monthlyPriceKrw: number;
    annualPriceKrw: number;
    positioning: string;
    features: Array<{
      id: ProToolFeatureId;
      label: string;
      description: string;
      readiness: 'foundation_ready' | 'planned' | 'waiting_for_ads';
    }>;
  };
  readiness: {
    salesRequested: boolean;
    readyForSales: boolean;
    aiAccessEqual: boolean;
    items: ReadinessItem[];
    sharedInvestmentAccess: string[];
  };
  aiLimits: {
    free: { chokDaily: number; analysisDaily: number };
    pro: { chokDaily: number; analysisDaily: number };
  };
}

interface ProDemandData {
  available: boolean;
  requested?: boolean;
  policyReady?: boolean;
  enabled: boolean;
  cohort: string;
  reason?: string;
  counts?: {
    eligibleExposures: number;
    offerOpened: number;
    offerDismissed: number;
    startClicks: number;
    waitlistSubmissions: number;
  };
  rates?: { start: number; waitlist: number };
  verdict?: 'insufficient_data' | 'stop_or_redesign' | 'iterate' | 'go';
}

const DEMAND_VERDICT_LABEL: Record<NonNullable<ProDemandData['verdict']>, string> = {
  insufficient_data: '표본 부족',
  stop_or_redesign: '중단 또는 재설계',
  iterate: '수정 후 재검증',
  go: '다음 단계 진행',
};

const FEATURE_ICONS: Record<ProToolFeatureId, typeof FileDown> = {
  advanced_portfolio_export: FileDown,
  backup_versions: DatabaseBackup,
  extended_history: DatabaseBackup,
  bulk_ocr_import: ScanLine,
  dashboard_presets: LayoutDashboard,
  ad_free: WalletCards,
};

const READINESS_LABEL = {
  foundation_ready: '기반 준비됨',
  planned: '구현 예정',
  waiting_for_ads: '광고 도입 시',
} as const;

export default function ProReadinessPanel() {
  const [data, setData] = useState<ProReadinessData | null>(null);
  const [demand, setDemand] = useState<ProDemandData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token || ''}` };
        const [response, demandResponse] = await Promise.all([
          fetch('/api/admin/pro-readiness', { headers }),
          fetch('/api/admin/pro-demand', { headers }),
        ]);
        if (!response.ok) throw new Error(`pro readiness ${response.status}`);
        const result = await response.json() as ProReadinessData;
        const demandResult = demandResponse.ok ? await demandResponse.json() as ProDemandData : null;
        if (!ignore) {
          setData(result);
          setDemand(demandResult);
        }
      } catch (cause) {
        console.error(cause);
        if (!ignore) setError('PRO 준비 상태를 불러오지 못했어요.');
      }
    }
    void load();
    return () => { ignore = true; };
  }, []);

  if (error) return <div role="alert" style={{ padding: 16, borderRadius: 12, background: '#FFF5F5', color: '#EF4452' }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#8B95A1' }}>PRO 준비 상태를 확인하는 중...</div>;

  const completed = data.readiness.items.filter((item) => item.ready).length;

  return (
    <div>
      <section style={{ padding: 20, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 16, background: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 6 }}>내부 상품안 · 판매 비활성</div>
            <h2 style={{ margin: 0, fontSize: 22, color: '#191F28' }}>{data.plan.name}</h2>
            <p style={{ margin: '8px 0 0', maxWidth: 620, color: '#4E5968', fontSize: 13, lineHeight: 1.6 }}>{data.plan.positioning}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#191F28' }}>월 {data.plan.monthlyPriceKrw.toLocaleString()}원</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#8B95A1' }}>연 {data.plan.annualPriceKrw.toLocaleString()}원</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: data.readiness.readyForSales ? '#F0FFF4' : '#F8F9FA', color: data.readiness.readyForSales ? '#16883E' : '#4E5968', fontSize: 12, fontWeight: 700 }}>
          {data.readiness.readyForSales
            ? '필수 게이트가 모두 충족됐어요. 파운더 승인 후 별도 결제 배치를 진행할 수 있어요.'
            : `판매 잠금 유지 · 준비 ${completed}/${data.readiness.items.length} · 환경변수 하나만으로 우회 활성화할 수 없어요.`}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, color: '#191F28', margin: '0 0 10px' }}>도구형 PRO 기능</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {data.plan.features.map((feature) => {
            const Icon = FEATURE_ICONS[feature.id];
            return (
              <div key={feature.id} style={{ padding: 16, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 12, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={17} strokeWidth={1.8} color="#0F8B84" aria-hidden="true" />
                  <strong style={{ color: '#191F28', fontSize: 13 }}>{feature.label}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8B95A1' }}>{READINESS_LABEL[feature.readiness]}</span>
                </div>
                <p style={{ margin: '9px 0 0', color: '#6B7684', fontSize: 12, lineHeight: 1.55 }}>{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, color: '#191F28', margin: '0 0 10px' }}>가격 가설 화면</h3>
        <ProDemandOffer preview placement="backup" />
      </section>

      <section style={{ marginBottom: 16, padding: 18, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 14, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 14, color: '#191F28', margin: 0 }}>가격 가설 지표</h3>
            <div style={{ marginTop: 4, fontSize: 11, color: '#8B95A1' }}>코호트 {demand?.cohort || '확인 중'}</div>
          </div>
          <span style={{ padding: '5px 9px', borderRadius: 999, background: demand?.enabled ? '#EAF7F6' : '#F2F4F6', color: demand?.enabled ? '#0F766E' : '#6B7684', fontSize: 10, fontWeight: 700 }}>
            {demand?.enabled ? '운영 노출 켜짐' : '운영 노출 꺼짐'}
          </span>
        </div>
        {demand?.requested && !demand.policyReady && (
          <p style={{ margin: '12px 0 0', padding: 10, borderRadius: 9, background: '#FFF8E6', color: '#8A5A00', fontSize: 11, lineHeight: 1.6 }}>
            노출 플래그가 요청됐지만 개인정보 처리방침 준비 게이트가 꺼져 있어 사용자에게는 표시되지 않아요.
          </p>
        )}
        {!demand?.available ? (
          <p style={{ margin: '14px 0 0', color: '#8B95A1', fontSize: 11, lineHeight: 1.6 }}>
            이벤트 DB가 아직 적용되지 않았어요. 운영 적용 전에는 미리보기만 확인할 수 있어요.
          </p>
        ) : (
          <>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              {[
                ['적격 노출', demand.counts?.eligibleExposures || 0],
                ['시작 클릭', demand.counts?.startClicks || 0],
                ['대기 신청', demand.counts?.waitlistSubmissions || 0],
                ['숨김', demand.counts?.offerDismissed || 0],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ padding: 11, borderRadius: 10, background: '#F8F9FA' }}>
                  <div style={{ color: '#8B95A1', fontSize: 10 }}>{label}</div>
                  <div style={{ marginTop: 4, color: '#191F28', fontSize: 18, fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: 11, borderRadius: 10, background: '#F0FAF9', color: '#0F766E', fontSize: 11, lineHeight: 1.6 }}>
              {demand.verdict ? DEMAND_VERDICT_LABEL[demand.verdict] : '판정 대기'} · 시작 {((demand.rates?.start || 0) * 100).toFixed(1)}% · 대기 신청 {((demand.rates?.waitlist || 0) * 100).toFixed(1)}%
            </div>
          </>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <div style={{ padding: 18, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 14, background: '#fff' }}>
          <h3 style={{ fontSize: 14, color: '#191F28', margin: '0 0 12px' }}>출시 게이트</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.readiness.items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                {item.ready
                  ? <CheckCircle2 size={16} color="#16A34A" aria-label="준비됨" />
                  : <Circle size={16} color="#B0B8C1" aria-label="준비 필요" />}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#191F28' }}>{item.label}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: '#8B95A1', lineHeight: 1.5 }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 14, background: '#fff' }}>
          <h3 style={{ fontSize: 14, color: '#191F28', margin: '0 0 12px' }}>무료·PRO 동일 접근</h3>
          <div style={{ padding: 12, borderRadius: 10, background: '#F0FAF9', color: '#0F766E', fontSize: 12, lineHeight: 1.6 }}>
            AI 분석 {data.aiLimits.free.analysisDaily}회 · 오늘 시장 흐름 {data.aiLimits.free.chokDaily}회로 동일해요.
          </div>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: '#4E5968', fontSize: 11, lineHeight: 1.8 }}>
            {data.readiness.sharedInvestmentAccess.map((access) => <li key={access}>{access}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
