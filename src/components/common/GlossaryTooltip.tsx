'use client';
import { useState } from 'react';

const GLOSSARY: Record<string, string> = {
  'RSI': '주가가 너무 많이 올랐는지(과매수) 떨어졌는지(과매도) 보여주는 숫자예요. 30 이하면 많이 떨어진 거, 70 이상이면 많이 오른 거예요.',
  'MACD': '주가의 흐름이 빨라지는지 느려지는지를 두 평균선의 거리로 보는 지표예요. MACD가 시그널선 위에 있으면 위쪽, 아래에 있으면 아래쪽으로 읽어요.',
  '골든크로스': '단기 평균선이 장기 평균선을 위로 지나간 모양이에요.',
  '데드크로스': '단기 평균선이 장기 평균선을 아래로 지나간 모양이에요.',
  '볼린저밴드': '주가가 평소에 오르내리던 범위를 보여주는 띠예요. 위쪽 띠에 닿으면 평소보다 빠르게 오른, 아래쪽이면 빠르게 내린 거예요.',
  '이동평균선': '최근 며칠간의 평균 주가를 선으로 이은 거예요. 주가가 이 선보다 위인지 아래인지로 흐름을 가늠해요.',
  '과매도': '최근 단기간에 많이 떨어진 상태를 가리키는 말이에요.',
  '과매수': '최근 단기간에 많이 오른 상태를 가리키는 말이에요.',
  '손절': '더 큰 손실을 막기 위해 손해를 보고 파는 것이에요.',
  '분할매수': '한 번에 사지 않고 여러 번 나눠서 사는 전략이에요. 평균 매수가를 낮출 수 있어요.',
};

interface Props {
  term: string;
  children?: React.ReactNode;
}

export default function GlossaryTooltip({ term, children }: Props) {
  const [show, setShow] = useState(false);
  const explanation = GLOSSARY[term];
  if (!explanation) return <>{children || term}</>;

  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <span
        onClick={() => setShow(!show)}
        style={{
          borderBottom: '1px dotted #3182F6',
          color: 'inherit',
          cursor: 'help',
        }}
      >
        {children || term}
      </span>
      {show && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setShow(false)}
          />
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            width: 'min(280px, 90vw)',
            padding: '14px 18px',
            background: '#191F28',
            color: '#fff',
            borderRadius: 12,
            fontSize: 13,
            lineHeight: 1.6,
            fontWeight: 400,
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3182F6', marginBottom: 6 }}>{term}</div>
            {explanation}
          </div>
        </>
      )}
    </span>
  );
}
