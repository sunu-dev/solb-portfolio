'use client';
import { useState } from 'react';

const GLOSSARY: Record<string, string> = {
  'RSI': '주가가 너무 많이 올랐는지(과매수) 떨어졌는지(과매도) 보여주는 숫자예요. 30 이하면 많이 떨어진 거, 70 이상이면 많이 오른 거예요.',
  'MACD': '주가의 상승/하락 힘이 세지는지 약해지는지 보여주는 지표예요. MACD가 시그널선 위로 올라가면 상승 신호, 아래로 내려가면 하락 신호예요.',
  '골든크로스': '단기 평균선이 장기 평균선을 위로 돌파하는 것이에요. 주가가 오르기 시작한다는 신호로 봐요.',
  '데드크로스': '단기 평균선이 장기 평균선을 아래로 돌파하는 것이에요. 주가가 내리기 시작한다는 신호로 봐요.',
  '볼린저밴드': '주가가 평소에 움직이는 범위를 보여주는 밴드예요. 밴드 위로 나가면 너무 올라간 거, 아래로 나가면 너무 떨어진 거예요.',
  '이동평균선': '최근 며칠간의 평균 주가를 선으로 이은 거예요. 주가가 이 선 위에 있으면 오르는 추세, 아래면 내리는 추세예요.',
  '과매도': '주가가 너무 많이 떨어져서 반등할 가능성이 있는 상태예요.',
  '과매수': '주가가 너무 많이 올라서 조정(하락)이 올 수 있는 상태예요.',
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
            width: 280,
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
