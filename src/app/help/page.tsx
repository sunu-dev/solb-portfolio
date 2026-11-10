'use client';

import appUI from '../../components/ui/AppUI.module.css';
import readingUI from '../../components/ui/ReadingUI.module.css';

import Link from 'next/link';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Section {
  title: string;
  items: { q: string; a: string }[];
}

const SECTIONS: Section[] = [
  { title: '처음 시작할 때', items: [
    { q: '주식을 모두 등록해야 하나요?', a: '관심 있는 회사 하나만 검색해도 시작할 수 있어요. 회사가 하는 일과 최근 소식, 가격 흐름을 먼저 살펴보세요. 보유 수량과 평균 매수가는 내 투자 기록이 필요할 때 추가하면 돼요.' },
    { q: '로그인 없이 무엇을 볼 수 있나요?', a: '회사 설명, 시세, 시장 소식과 무료 배경 개념을 읽을 수 있어요. AI 분석과 계정에 연결되는 기능은 로그인 후 이용해요. 가입에는 성인 확인·필수 동의와 현재 베타의 초대 조건이 적용돼요.' },
    { q: '샘플 포트폴리오는 실제 투자 기록인가요?', a: '샘플은 화면을 살펴보는 예시예요. 실제 보유 종목과 구분해 표시하며, 체험을 마치면 해제할 수 있어요.' },
  ] },
  { title: '회사와 소식 이해하기', items: [
    { q: '주비에게 어떻게 질문하나요?', a: '종목 상세의 ‘주비에게 더 물어보기’에서 궁금한 질문을 골라보세요. 로그인하면 AI 답변을 요청할 수 있어요. 이용 가능한 횟수는 질문 영역에 표시돼요. ‘먼저 알아둘 개념’은 AI 횟수를 쓰지 않고 읽을 수 있어요.' },
    { q: '기사 아래 설명이 주가가 움직인 이유인가요?', a: '기사 제목과 연결한 배경 개념은 일반적인 설명이에요. 기사 본문 요약이나 이번 주가 변동의 원인 분석으로 단정하지 않아요. 사실의 출처와 날짜를 함께 확인해 주세요.' },
    { q: 'PER이나 배당수익률은 어디 있나요?', a: '현재 주비는 기업 재무 수치를 제공하지 않아요. 회사가 하는 일, 시세와 소식, 투자 개념을 중심으로 살펴볼 수 있어요. 실제 실적과 배당 계획은 회사의 공시 자료에서 확인해 주세요.' },
  ] },
  { title: '내 투자 기록과 계산', items: [
    { q: '추가 매수 금액은 어떻게 계산하나요?', a: '종목 상세 아래 ‘내 투자에 연결하기’에서 ‘금액으로 미리 계산하기’를 열어보세요. 가정한 금액으로 살 수 있는 주식 수와 비중 변화를 살펴볼 수 있어요. 실제 주문은 증권사에서 진행해야 해요.' },
    { q: '증권사 계좌와 자동으로 연결되나요?', a: '현재는 직접 입력하거나 파일로 가져온 기록을 사용해요. 종목 추가·편집에서 증권사를 구분할 수 있지만 실제 계좌와 자동으로 동기화되지는 않아요. 스크린샷 가져오기는 현재 비활성 상태예요.' },
    { q: '기록을 옮기거나 복구하려면 어떻게 하나요?', a: '설정의 기록·가져오기·복구에서 사용할 도구를 골라보세요. 파일에 담긴 종목·수량·평균 매수가를 확인하고, 안내에 따라 기존 기록에 반영할 수 있어요.' },
  ] },
  { title: '시장 변화와 과거 비교', items: [
    { q: '시장 전체를 실시간으로 확인하나요?', a: '리포트에서 정해진 지수·업종·공시·기사 범위를 주기적으로 확인해요. ‘무엇을 얼마나 확인했나요?’에서 확인 범위와 누락·지연을 볼 수 있어요. 소식이 없다는 것이 시장에 아무 일도 없다는 뜻은 아니에요.' },
    { q: '과거 시장과 비교한 수익률은 내 수익률인가요?', a: '선택한 기간의 종가를 비교한 가격 변화예요. 내 매수일·매수가·배당·비용을 반영한 실제 투자 수익률과 달라요. 기준일과 출처를 함께 확인해 주세요.' },
  ] },
  { title: '알림과 화면 설정', items: [
    { q: '알림을 받으려면 무엇이 필요한가요?', a: '알림 설정에서 원하는 채널을 켜고, 푸시를 사용할 때는 브라우저 권한도 허용해 주세요. 기기·브라우저 환경에 따라 수신이 제한될 수 있어요. 이메일과 푸시는 각각 설정할 수 있어요.' },
    { q: '자주 쓰는 도구는 어디서 찾나요?', a: 'PC의 ‘전체’, 모바일의 ‘더보기’에서 도구를 찾을 수 있어요. 기능 옆 고정 버튼을 누르면 바로가기에 추가돼요.' },
    { q: '계정을 삭제하려면 어떻게 하나요?', a: '설정의 계정 영역에서 삭제를 시작할 수 있어요. 삭제 전 확인 안내가 나오며, 완료하면 계정에 연결된 데이터를 복구할 수 없어요.' },
  ] },
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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          <ArrowLeft size={18} />
          돌아가기
        </Link>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <HelpCircle size={28} color="var(--brand-primary)" />
          <h1 className={appUI.pageTitle} style={{ color: 'var(--text-primary)', margin: 0 }}>
            주비 도움말
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28 }}>
          처음 사용하시나요? 핵심 기능을 한눈에 살펴보세요.
        </p>

        {/* 투어 다시 보기 CTA */}
        <button className={appUI.primaryButton}
          onClick={() => {
            // 풀 페이지 이동 후 setTimeout으로 open-tour를 쏘면 콜백이 파기돼 투어가 안 떴음.
            // CoachMark가 마운트 시 읽는 solb_tour_pending 플래그를 세팅해 본 화면 도착 직후 시작.
            try { localStorage.setItem('solb_tour_pending', '1'); } catch { /* storage full */ }
            window.location.href = '/';
          }}
          style={{ width: '100%', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          화면 둘러보기 다시 시작
        </button>

        {SECTIONS.map((sec) => (
          <section key={sec.title} style={{ marginBottom: 32 }}>
            <h2 className={readingUI.sectionTitle} style={{ color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              {sec.title}
            </h2>
            <div style={{ borderTop: '1px solid var(--border-light)' }}>
              {sec.items.map((it, i) => (
                <details
                  key={i}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                  }}
                >
                  <summary className={readingUI.disclosure} >
                    {it.q}
                  </summary>
                  <p style={{ fontSize: 15, color: 'var(--text-body)', lineHeight: 1.8, marginTop: 10, marginBottom: 0 }}>
                    {it.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <BugReportSection />

        <div style={{ padding: '20px 0', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong>참고</strong> · 주비는 정보 제공 도구이며 투자 자문이 아니에요. 모든 투자 판단의 책임은 이용자에게 있어요.
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
        <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>
          소중한 의견 고마워요. 검토 후 필요하면 입력해주신 이메일로 연락드릴게요.
        </p>
        <button className={appUI.textButton}
          onClick={() => setStatus('idle')}
          style={{ marginTop: 10 }}
        >
          또 보내기
        </button>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 className={readingUI.sectionTitle} style={{ color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24 }}>💬</span>
        버그·의견 신고
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
        뭔가 이상하거나 더 있으면 좋겠다 싶은 게 있으면 알려주세요. 베타 기간엔 모든 신고를 직접 읽어요.
      </p>

      <form onSubmit={handleSubmit} style={{ borderTop: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { v: 'bug', label: '🐛 버그' },
            { v: 'feedback', label: '💬 의견' },
            { v: 'praise', label: '✨ 칭찬' },
            { v: 'payment', label: '💳 결제' },
          ] as const).map(opt => (
            <button className={appUI.secondaryButton}
              type="button"
              key={opt.v}
              onClick={() => setCategory(opt.v)}
              style={{ border: category === opt.v ? '1px solid var(--brand-primary, #0E7C7B)' : '1px solid var(--border-light, #E5E8EB)', background: category === opt.v ? 'rgba(14,124,123,0.08)' : 'var(--surface)', color: category === opt.v ? 'var(--brand-primary, #0E7C7B)' : 'var(--text-body)' }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <textarea className={appUI.field}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={category === 'bug'
            ? '어디서 무엇이 안 되는지 적어주세요. (예: 뉴스탭에서 한국 시장 클릭하면 빈 화면)'
            : '편하게 적어주세요'}
          maxLength={2000}
          rows={5}
          style={{ resize: 'vertical' }}
        />

        <input className={appUI.field}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="응답 받을 이메일 (선택, 비로그인일 때 권장)"
          maxLength={200}

        />

        {errorMsg && (
          <div style={{ fontSize: 12, color: '#EF4452' }}>{errorMsg}</div>
        )}

        <button className={appUI.primaryButton}
          type="submit"
          disabled={status === 'sending'}
          style={{ background: status === 'sending' ? 'var(--border-strong)' : 'var(--brand-fill)', color: status === 'sending' ? 'var(--text-body)' : 'var(--on-brand-fg)', border: 'none' }}
        >
          {status === 'sending' ? '보내는 중...' : '보내기'}
        </button>
      </form>
    </section>
  );
}
