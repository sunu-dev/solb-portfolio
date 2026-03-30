'use client';

interface Props {
  compact?: boolean;
}

export default function Disclaimer({ compact }: Props) {
  if (compact) {
    return (
      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', lineHeight: 1.6, textAlign: 'center', padding: '8px 0' }}>
        AI가 생성한 참고 자료이며, 투자 자문이 아닙니다. 투자 판단의 책임은 이용자에게 있습니다.
      </div>
    );
  }

  return (
    <div style={{
      fontSize: 11,
      color: 'var(--text-tertiary, #B0B8C1)',
      lineHeight: 1.7,
      padding: '16px 20px',
      borderRadius: 12,
      background: 'var(--bg-subtle, #F8F9FA)',
      marginTop: 16,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary, #8B95A1)' }}>투자 유의사항</div>
      <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <li>본 서비스는 투자자문업 또는 투자일임업에 해당하지 않으며, 정보 제공 목적으로만 운영됩니다.</li>
        <li>본 분석은 인공지능(AI)이 자동으로 생성한 것으로, 실제 투자 전문가의 의견이 아닙니다.</li>
        <li>특정 금융투자상품의 매수 또는 매도를 권유하지 않습니다.</li>
        <li>제공되는 정보의 정확성, 완전성, 적시성을 보증하지 않습니다.</li>
        <li>과거 실적은 미래 수익을 보장하지 않습니다.</li>
        <li>투자 판단 및 그에 따른 손실에 대한 책임은 전적으로 이용자에게 있습니다.</li>
        <li>투자 결정 전 금융 전문가와 상담하시기를 권장합니다.</li>
        <li>본 서비스의 AI 캐릭터는 가상의 분석 도구이며, 실존 인물과 무관합니다.</li>
      </ul>
    </div>
  );
}
