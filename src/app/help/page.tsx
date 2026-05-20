'use client';

import Link from 'next/link';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Section {
  emoji: string;
  title: string;
  items: { q: string; a: string }[];
}

const SECTIONS: Section[] = [
  {
    emoji: '🎯',
    title: 'AI 촉 — 매일 새 종목 추천',
    items: [
      {
        q: 'AI 촉이 뭐예요?',
        a: '시장 상황(VIX·금리·이벤트)과 내 포트폴리오 약점(섹터 편중·고베타 집중 등)을 분석해, 서로 다른 섹터의 종목 3개를 매일 추천해드려요. 추천이 아닌 정보 제공이며, 투자 판단은 본인이 합니다.',
      },
      {
        q: '하루 몇 번 받을 수 있어요?',
        a: '무료 회원은 하루 1번, PRO 회원은 하루 30번까지 받을 수 있어요. 페이지를 새로고침해도 한도는 차감되지 않아요. 명시적으로 "새로 촉 받기" 버튼을 눌러야 1번 차감됩니다.',
      },
      {
        q: '비로그인으로도 사용 가능한가요?',
        a: '비로그인 사용자는 AI 호출이 차단돼요. 카카오로 3초 만에 로그인하면 즉시 무료로 받을 수 있어요. (서비스 비용을 통제하기 위함이에요)',
      },
    ],
  },
  {
    emoji: '🧑‍🏫',
    title: '멘토 분석 — 6명의 관점',
    items: [
      {
        q: '멘토가 누구누구 있어요?',
        a: '워런 버핏(가치투자), 피터 린치(성장+생활관찰), 레이 달리오(거시·올웨더), 캐시 우드(혁신), 리처드 데니스(추세), 윌리엄 오닐(CANSLIM). 같은 종목도 멘토에 따라 평가가 다를 수 있어요.',
      },
      {
        q: '어떻게 사용해요?',
        a: '분석 화면에서 멘토 카드를 클릭하면 그 멘토의 철학으로 분석한 보고서를 받아볼 수 있어요. 하루 3번까지 가능합니다.',
      },
    ],
  },
  {
    emoji: '📊',
    title: '건강 점수 — 내 포트폴리오 상태',
    items: [
      {
        q: '점수가 어떻게 계산되나요?',
        a: '4가지 축으로 100점 만점: 분산도(섹터 다양성) / 수익률 균형 / 손절 설정 유무 / 매수 평균가 vs 현재가 거리. 80점 이상이면 양호, 60점 미만이면 점검 권장.',
      },
      {
        q: '점수가 낮으면 뭘 해야 하나요?',
        a: '대시보드 우측의 "개선 제안" 영역을 확인하세요. AI 촉으로 누락 섹터를 보완하거나, 매수 단가를 조정하는 등 구체적 액션을 안내해드려요.',
      },
    ],
  },
  {
    emoji: '🔔',
    title: '알림 — 종목 상태 변화 감지',
    items: [
      {
        q: '어떤 알림이 와요?',
        a: '52주 신고가/신저가 근접, RSI 과매수/과매도, 평균 단가 대비 ±10% 등락, 거래량 평소의 N배 이상, 손절가 근접 등. 사용자가 설정한 손절가·목표가 근접 시에도 알림.',
      },
      {
        q: '푸시 알림을 받으려면?',
        a: '헤더의 🔔 알림 벨 → 설정 → 푸시 활성화. 브라우저 권한 허용 필요. 카카오톡/SMS는 현재 미지원 (베타 이후 검토).',
      },
    ],
  },
  {
    emoji: '🛒',
    title: '매수 시뮬레이션 — 매수 전 시뮬',
    items: [
      {
        q: '어떻게 사용해요?',
        a: '종목 분석 화면에서 "매수 시뮬" 탭. 매수가·수량·환율 입력하면 비중 변화, 평단가 변화, 환산 손익을 미리 볼 수 있어요. 실제 매수는 본인 증권 앱에서.',
      },
    ],
  },
  {
    emoji: '🏦',
    title: '증권사 통합 — 여러 증권사를 한 화면에',
    items: [
      {
        q: '증권사가 여러 곳인데 통합해서 볼 수 있나요?',
        a: '네. 종목 추가/편집 화면의 "🏦 증권사" 드롭다운에서 토스·키움·미래에셋 등 한국 증권사 15곳 중 선택할 수 있어요. 2개 이상 등록하면 메인 화면에 "증권사별 보유 현황" 카드가 자동으로 나타나요.',
      },
      {
        q: '꼭 입력해야 하나요?',
        a: '아니요. 선택 사항이에요. 한 증권사만 쓰시면 그냥 비워두시면 돼요. 비워두면 화면 변화가 전혀 없어요.',
      },
      {
        q: '증권사별로 어떤 분석을 받을 수 있어요?',
        a: '월말 챕터 회고에 "토스 챔피언 vs 키움 챔피언" 처럼 증권사별 우수 종목이 표시돼요. 어느 계좌의 운용이 더 잘 굴러가는지 한눈에 보여드려요.',
      },
      {
        q: '실시간으로 증권사와 연동되나요?',
        a: '아니요. 사용자가 직접 입력한 정보예요. 한국 증권사는 자동 연동 API를 거의 제공하지 않아서, 주비는 OCR로 스크린샷에서 증권사를 자동 추정하거나 사용자가 직접 선택하는 방식을 사용해요.',
      },
      {
        q: 'ISA·IRP·연금 계좌도 분리할 수 있나요?',
        a: '현재는 증권사만 구분돼요. ISA·IRP 등 계좌 종류별 세무 안내(비과세 한도, 세액공제 시뮬)는 베타 후반에 추가될 예정이에요. 이건 토스도 제공하지 않는 주비만의 차별 기능이 될 거예요.',
      },
    ],
  },
];

export default function HelpPage() {
  useEffect(() => {
    logApiCall('help_opened');
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #fff)' }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface, #fff)', borderBottom: '1px solid var(--border-light, #F2F4F6)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#191F28', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          <ArrowLeft size={18} />
          돌아가기
        </Link>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <HelpCircle size={28} color="var(--brand-primary)" />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#191F28', margin: 0 }}>
            주비 도움말
          </h1>
        </div>
        <p style={{ fontSize: 14, color: '#8B95A1', marginBottom: 28 }}>
          처음 사용하시나요? 핵심 기능을 한눈에 살펴보세요.
        </p>

        {/* 투어 다시 보기 CTA */}
        <button
          onClick={() => {
            window.location.href = '/';
            setTimeout(() => window.dispatchEvent(new CustomEvent('open-tour')), 400);
          }}
          style={{
            width: '100%', padding: '14px 18px', marginBottom: 24,
            borderRadius: 12, background: 'rgba(14,124,123,0.08)', color: 'var(--brand-primary)',
            border: '1px dashed rgba(14,124,123,0.3)',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          🎬 본 화면 투어 다시 보기
        </button>

        {SECTIONS.map((sec) => (
          <section key={sec.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#191F28', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>{sec.emoji}</span>
              {sec.title}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sec.items.map((it, i) => (
                <details
                  key={i}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-subtle, #F8F9FA)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  <summary style={{ fontSize: 14, fontWeight: 600, color: '#191F28', cursor: 'pointer', listStyle: 'none' }}>
                    Q. {it.q}
                  </summary>
                  <p style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.7, marginTop: 10, marginBottom: 0 }}>
                    {it.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <BugReportSection />

        <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,149,0,0.06)', fontSize: 12, color: '#FF9500', lineHeight: 1.6 }}>
          <strong>참고</strong> · 주비는 정보 제공 도구이며 투자 자문이 아닙니다. 모든 투자 판단의 책임은 이용자에게 있습니다.
        </div>
      </div>
    </div>
  );
}

// 인앱 버그/피드백 신고 폼 — 사장 카톡 1:1 인입 운영 SLA 붕괴 차단용.
// 응답은 Slack #beta-bug 채널 + bug_reports 테이블에 저장.
function BugReportSection() {
  const [category, setCategory] = useState<'bug' | 'feedback' | 'praise' | 'payment'>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      setErrorMsg('내용을 5자 이상 입력해주세요.');
      return;
    }
    setStatus('sending');
    setErrorMsg('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
      const r = await fetch('/api/feedback/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          category,
          message: message.trim(),
          page: '/help',
          email: email.trim() || undefined,
          viewport,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setStatus('ok');
        setMessage('');
        setEmail('');
      } else {
        setStatus('error');
        setErrorMsg(d.error || '전송 실패');
      }
    } catch {
      setStatus('error');
      setErrorMsg('네트워크 오류. 잠시 후 다시 시도해주세요.');
    }
  };

  if (status === 'ok') {
    return (
      <section style={{ marginBottom: 24, padding: 20, borderRadius: 12, background: 'rgba(14,124,123,0.06)', border: '1px solid rgba(14,124,123,0.2)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-primary, #0E7C7B)', marginBottom: 6 }}>
          ✅ 잘 받았어요
        </div>
        <p style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.6, margin: 0 }}>
          소중한 의견 고마워요. 검토 후 필요하면 입력해주신 이메일로 연락드릴게요.
        </p>
        <button
          onClick={() => setStatus('idle')}
          style={{ marginTop: 10, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--brand-primary, #0E7C7B)', background: 'transparent', color: 'var(--brand-primary, #0E7C7B)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          또 보내기
        </button>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#191F28', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24 }}>💬</span>
        버그·의견 신고
      </h2>
      <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 14, lineHeight: 1.6 }}>
        뭔가 이상하거나 더 있으면 좋겠다 싶은 게 있으면 알려주세요. 베타 기간엔 모든 신고를 직접 읽어요.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { v: 'bug', label: '🐛 버그' },
            { v: 'feedback', label: '💬 의견' },
            { v: 'praise', label: '✨ 칭찬' },
            { v: 'payment', label: '💳 결제' },
          ] as const).map(opt => (
            <button
              type="button"
              key={opt.v}
              onClick={() => setCategory(opt.v)}
              style={{
                padding: '6px 14px', borderRadius: 999,
                border: category === opt.v ? '1px solid var(--brand-primary, #0E7C7B)' : '1px solid #E5E8EB',
                background: category === opt.v ? 'rgba(14,124,123,0.08)' : '#FFFFFF',
                color: category === opt.v ? 'var(--brand-primary, #0E7C7B)' : '#4E5968',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={category === 'bug'
            ? '어디서 무엇이 안 되는지 적어주세요. (예: 뉴스탭에서 한국 시장 클릭하면 빈 화면)'
            : '편하게 적어주세요'}
          maxLength={2000}
          rows={5}
          style={{
            padding: 12, borderRadius: 10, border: '1px solid #E5E8EB',
            fontSize: 13, lineHeight: 1.6, color: '#191F28', resize: 'vertical',
            fontFamily: 'inherit', outline: 'none',
          }}
        />

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="응답 받을 이메일 (선택, 비로그인일 때 권장)"
          maxLength={200}
          style={{
            padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E8EB',
            fontSize: 13, color: '#191F28', outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        {errorMsg && (
          <div style={{ fontSize: 12, color: '#EF4452' }}>{errorMsg}</div>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          style={{
            padding: '12px 20px', borderRadius: 10,
            background: status === 'sending' ? '#B0B8C1' : 'var(--brand-primary, #0E7C7B)',
            color: '#FFFFFF', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: status === 'sending' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'sending' ? '보내는 중...' : '보내기'}
        </button>
      </form>
    </section>
  );
}
