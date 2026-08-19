'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatKrw } from '@/utils/koreanNumber';
import { ArrowRight, Check, DatabaseBackup, History, ScanLine, X } from 'lucide-react';
import { PRO_PLAN } from '@/config/proPlan';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import {
  getProDemandActivityCounts,
  subscribeProDemandActivity,
} from '@/lib/proDemandActivity';
import {
  isQualifiedProDemandCandidate,
  type ProDemandPlacement,
} from '@/lib/proDemandValidation';
import {
  loadProDemandRuntimeConfig,
  trackProDemandEvent,
  type ProDemandRuntimeConfig,
} from '@/lib/proDemandTelemetry';
import { usePortfolioStore } from '@/store/portfolioStore';

const DISMISSED_KEY = 'solb_pro_demand_dismissed_v1';
const EXPOSURE_KEY_PREFIX = 'solb_pro_demand_exposed_v1';
const PREVIEW_CONFIG: ProDemandRuntimeConfig = {
  enabled: true,
  cohort: 'admin-preview',
  monthlyPriceKrw: PRO_PLAN.monthlyPriceKrw,
};
const OFFER_FEATURES = [
  { Icon: DatabaseBackup, title: '자동 백업과 이전 기록 복구', copy: '수량·평단·메모가 잘못 바뀌면 이전 상태로 되돌려요.' },
  { Icon: History, title: '변경 이력 확인', copy: '무엇이 언제 달라졌는지 전후 값을 확인해요.' },
  { Icon: ScanLine, title: '여러 장 일괄 정리', copy: '증권앱 화면 여러 장을 읽고 중복 후보를 확인해요.' },
] as const;

interface ProDemandOfferProps {
  preview?: boolean;
  placement?: ProDemandPlacement;
}

type OfferStep = 'details' | 'waitlist' | 'done';

export default function ProDemandOffer({
  preview = false,
  placement = 'backup',
}: ProDemandOfferProps) {
  const stocks = usePortfolioStore((state) => state.stocks);
  const hydrated = useHasHydrated();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activity, setActivity] = useState(() => ({ visitsLast14Days: 0, importOrEditCountLast14Days: 0 }));
  const [config, setConfig] = useState<ProDemandRuntimeConfig | null>(preview ? PREVIEW_CONFIG : null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<OfferStep>('details');

  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(open, dialogRef, close);

  useEffect(() => {
    if (!hydrated || preview) return;
    const update = () => setActivity(getProDemandActivityCounts());
    update();
    return subscribeProDemandActivity(update);
  }, [hydrated, preview]);

  const candidate = useMemo(() => {
    const holdings = stocks.investing.filter((stock) => !stock.demo);
    const brokers = new Set(holdings.map((stock) => stock.broker).filter(Boolean));
    return {
      brokerCount: brokers.size,
      holdingCount: holdings.length,
      visitsLast14Days: activity.visitsLast14Days,
      importOrEditCountLast14Days: activity.importOrEditCountLast14Days,
    };
  }, [activity, stocks.investing]);

  const qualified = preview || isQualifiedProDemandCandidate(candidate);

  useEffect(() => {
    if (preview || !hydrated || !qualified) return;
    let ignore = false;
    void loadProDemandRuntimeConfig().then((next) => {
      if (ignore) return;
      setConfig(next);
      if (!next) return;
      try {
        setDismissed(localStorage.getItem(DISMISSED_KEY) === next.cohort);
      } catch { /* private mode */ }
    });
    return () => { ignore = true; };
  }, [hydrated, preview, qualified]);

  const visible = hydrated && qualified && config?.enabled && !dismissed;

  useEffect(() => {
    if (!visible || preview || !config) return;
    const exposureKey = `${EXPOSURE_KEY_PREFIX}:${config.cohort}:${placement}`;
    try {
      if (sessionStorage.getItem(exposureKey)) return;
      sessionStorage.setItem(exposureKey, '1');
    } catch { /* 세션 저장 실패 시 현재 마운트에서만 전송 */ }
    void trackProDemandEvent('pro_offer_exposed', placement, config.cohort);
  }, [config, placement, preview, visible]);

  if (!visible || !config) return null;

  const handleOpen = () => {
    setStep('details');
    setOpen(true);
    if (!preview) void trackProDemandEvent('pro_offer_opened', placement, config.cohort);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, config.cohort); } catch { /* private mode */ }
    if (!preview) void trackProDemandEvent('pro_offer_dismissed', placement, config.cohort);
  };

  const handleStart = () => {
    setStep('waitlist');
    if (!preview) void trackProDemandEvent('pro_start_clicked', placement, config.cohort);
  };

  const handleWaitlist = () => {
    setStep('done');
    if (!preview) void trackProDemandEvent('pro_waitlist_submitted', placement, config.cohort);
  };

  return (
    <>
      <section
        aria-label="주비 플러스 사전 안내"
        style={{
          position: 'relative',
          padding: '18px 18px 17px',
          border: '1px solid var(--border-light, #E5E8EB)',
          borderRadius: 16,
          background: 'var(--card-bg, #FFFFFF)',
        }}
      >
        {!preview && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="주비 플러스 안내 숨기기"
            style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, display: 'grid', placeItems: 'center', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer' }}
          >
            <X size={17} color="var(--text-tertiary, #B0B8C1)" aria-hidden="true" />
          </button>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: preview ? 0 : 30 }}>
          <div style={{ width: 40, height: 40, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--brand-primary-light, rgba(14, 124, 123, 0.08))' }}>
            <DatabaseBackup size={20} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text-primary, #191F28)', fontSize: 15 }}>기록을 다시 정리하는 시간을 줄여보세요</strong>
              {preview && <span style={{ fontSize: 10, color: 'var(--brand-primary, #0E7C7B)', fontWeight: 700 }}>내부 미리보기</span>}
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary, #6B7684)', fontSize: 12, lineHeight: 1.6 }}>
              자동 백업과 이전 기록 복구, 여러 장 중복 확인을 준비하고 있어요.
            </p>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary, #4E5968)', fontSize: 12 }}>
            월 {formatKrw(config.monthlyPriceKrw, { prefix: false, suffix: '원', short: false })} 가설 · 지금은 결제되지 않아요
          </span>
          <button
            type="button"
            onClick={handleOpen}
            style={{ minHeight: 40, padding: '9px 13px', display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 10, background: 'var(--text-primary, #191F28)', color: 'var(--surface, #FFFFFF)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          >
            자세히 보기 <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </section>

      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.52)' }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pro-demand-title"
            tabIndex={-1}
            style={{ width: 'min(100%, 480px)', maxHeight: 'min(720px, 90vh)', overflowY: 'auto', padding: 24, borderRadius: 20, background: 'var(--card-bg, #FFFFFF)', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'var(--brand-primary, #0E7C7B)', fontSize: 11, fontWeight: 800 }}>주비 플러스 준비 중</div>
                <h2 id="pro-demand-title" style={{ margin: '7px 0 0', color: 'var(--text-primary, #191F28)', fontSize: 22, lineHeight: 1.35 }}>
                  내 기록을 잃지 않고,<br />다시 입력하지 않도록
                </h2>
              </div>
              <button type="button" onClick={close} aria-label="닫기" style={{ width: 40, height: 40, flex: '0 0 auto', display: 'grid', placeItems: 'center', border: 0, borderRadius: 12, background: 'var(--bg-subtle, #F2F4F6)', cursor: 'pointer' }}>
                <X size={18} color="var(--text-secondary, #6B7684)" aria-hidden="true" />
              </button>
            </div>

            {step === 'details' && (
              <>
                <div style={{ marginTop: 22, display: 'grid', gap: 10 }}>
                  {OFFER_FEATURES.map(({ Icon, title, copy }) => (
                    <div key={title} style={{ padding: 14, display: 'flex', gap: 11, borderRadius: 13, background: 'var(--bg-subtle, #F8F9FA)' }}>
                      <Icon size={18} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                      <div>
                        <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 13, fontWeight: 700 }}>{title}</div>
                        <div style={{ marginTop: 4, color: 'var(--text-secondary, #6B7684)', fontSize: 11, lineHeight: 1.55 }}>{copy}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: 15, borderRadius: 14, border: '1px solid var(--border-light, #E5E8EB)' }}>
                  <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 20, fontWeight: 800 }}>월 {formatKrw(config.monthlyPriceKrw, { prefix: false, suffix: '원', short: false })}</div>
                  <div style={{ marginTop: 5, color: 'var(--text-tertiary, #8B95A1)', fontSize: 11 }}>투자정보와 AI는 무료 사용자와 동일해요.</div>
                </div>
                <button type="button" onClick={handleStart} style={{ marginTop: 14, width: '100%', minHeight: 50, border: 0, borderRadius: 13, background: 'var(--brand-primary, #0E7C7B)', color: 'var(--surface, #FFFFFF)', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}>
                  월 {formatKrw(config.monthlyPriceKrw, { prefix: false, suffix: '원', short: false })}으로 시작
                </button>
                <p style={{ margin: '9px 0 0', textAlign: 'center', color: 'var(--text-tertiary, #8B95A1)', fontSize: 10 }}>
                  아직 준비 단계라 결제 정보는 받지 않고 비용도 청구하지 않아요.
                </p>
              </>
            )}

            {step === 'waitlist' && (
              <div style={{ marginTop: 28 }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary, #191F28)', fontSize: 18 }}>이 가격이라면 사용해보고 싶으신가요?</h3>
                <p style={{ margin: '9px 0 20px', color: 'var(--text-secondary, #6B7684)', fontSize: 12, lineHeight: 1.65 }}>
                  출시 알림을 신청하면 준비가 끝났을 때 알려드려요. 지금은 결제되지 않아요.
                </p>
                <button type="button" onClick={handleWaitlist} style={{ width: '100%', minHeight: 50, border: 0, borderRadius: 13, background: 'var(--brand-primary, #0E7C7B)', color: 'var(--surface, #FFFFFF)', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}>
                  출시 알림 신청
                </button>
                <button type="button" onClick={close} style={{ marginTop: 8, width: '100%', minHeight: 44, border: 0, borderRadius: 12, background: 'transparent', color: 'var(--text-secondary, #6B7684)', cursor: 'pointer', fontSize: 12 }}>
                  다음에 볼게요
                </button>
              </div>
            )}

            {step === 'done' && (
              <div style={{ padding: '36px 0 18px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, margin: '0 auto', display: 'grid', placeItems: 'center', borderRadius: 16, background: 'var(--brand-primary-light, rgba(14, 124, 123, 0.08))' }}>
                  <Check size={24} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                </div>
                <h3 style={{ margin: '16px 0 0', color: 'var(--text-primary, #191F28)', fontSize: 19 }}>신청했어요</h3>
                <p style={{ margin: '8px 0 20px', color: 'var(--text-secondary, #6B7684)', fontSize: 12, lineHeight: 1.6 }}>
                  준비가 끝나면 알려드릴게요. 결제 정보는 받지 않았어요.
                </p>
                <button type="button" onClick={close} style={{ minWidth: 120, minHeight: 44, border: 0, borderRadius: 12, background: 'var(--text-primary, #191F28)', color: 'var(--surface, #FFFFFF)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
