export const metadata = {
  title: '주비 — 이용약관',
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px', fontFamily: "'Pretendard Variable', sans-serif", background: 'var(--bg, #fff)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #191F28)' }}>이용약관</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 4 }}>시행일: 2026년 5월 15일 (v2)</p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 24 }}>본 서비스는 현재 <strong style={{ color: '#3182F6' }}>베타 단계</strong>로, 무료로 제공됩니다.</p>

      <Section title="제1조 (목적)">
        이 약관은 주비(이하 &quot;서비스&quot;)가 제공하는 투자 정보 서비스의 이용 조건 및 절차, 서비스와 이용자의 권리·의무 및 책임 사항 등을 규정함을 목적으로 합니다.
      </Section>

      <Section title="제2조 (서비스의 정의)">
        서비스는 AI 기반 주식 포트폴리오 분석 정보를 제공하는 웹 애플리케이션(PWA)입니다. 서비스는 자본시장법상 투자자문업, 투자일임업, 유사투자자문업 어디에도 해당하지 않으며, 불특정 다수에게 정보를 제공할 목적으로만 운영됩니다. 서비스는 어떠한 형태로도 종목 조언이나 매매 권유의 대가를 받지 않습니다.
        <br /><br />
        서비스의 종목 노출 범위(universe)는 사전에 공개된 객관 기준(시가총액, 상장 경과 기간, 데이터 정상성)에 의해서만 결정되며, 그 기준은 별도 문서(<a href="https://github.com/sunu-dev/solb-portfolio/blob/main/docs/UNIVERSE_INCLUSION_CRITERIA.md" target="_blank" rel="noopener noreferrer" style={{ color: '#3182F6' }}>UNIVERSE_INCLUSION_CRITERIA.md</a>)에 명시되어 있습니다.
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ol>
          <li>이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.</li>
          <li>서비스는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지 후 7일이 경과한 날부터 효력이 발생합니다.</li>
          <li>이용자가 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단하고 계정을 삭제할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제4조 (회원 가입 및 계정)">
        <ol>
          <li>서비스는 소셜 로그인(Google, Kakao)을 통해 회원 가입할 수 있습니다.</li>
          <li>회원은 정확한 정보를 제공해야 하며, 허위 정보로 인한 책임은 회원에게 있습니다.</li>
          <li>회원은 계정 정보를 안전하게 관리해야 하며, 타인에게 공유하지 않아야 합니다.</li>
          <li>회원은 언제든 프로필 메뉴에서 계정을 삭제할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제5조 (서비스의 내용)">
        서비스는 다음 기능을 제공합니다.
        <ol>
          <li>주식 포트폴리오 관리 (종목 추가, 수정, 삭제, OCR 자동 등록)</li>
          <li>실시간 시세 정보 (약 15분 지연)</li>
          <li>AI 기반 기술적 분석 및 멘토 6인 관점 분석</li>
          <li>AI 관찰 후보 종목 안내(이하 &quot;AI 촉&quot;) — 객관 기준 기반 큐레이션</li>
          <li>스마트 알림 (가격 변동, 기술 지표 변화) — 푸시·이메일 옵트인</li>
          <li>포트폴리오 건강 점수 및 레이더 차트</li>
          <li>월별 챕터(시즌제) 회고 자동 생성</li>
          <li>증권사별 자산 관리 및 동일 종목 통합 평단가 (한국 증권사 15개 + 기타)</li>
          <li>신규 상장 종목 감지·검수 파이프라인</li>
          <li>관련 뉴스 제공</li>
          <li>1탭 피드백 (👍/👎) 수집</li>
        </ol>
      </Section>

      <Section title="제6조 (서비스 이용의 제한)">
        <ol>
          <li>AI 기능은 다음과 같이 제한됩니다 (베타 기간 중 변경될 수 있음):
            <ul style={{ marginTop: 6, marginLeft: 12 }}>
              <li><strong>AI 촉</strong>: 영구 무료. 일 1회 (Free) / 일 30회 (PRO).</li>
              <li><strong>AI 분석(기술적·멘토)</strong>: 로그인 필수. 일 3회 (Free) / 일 30회 (PRO).</li>
              <li><strong>비로그인 사용자</strong>: AI 기능 사용 불가 (시세·차트만 제공).</li>
            </ul>
          </li>
          <li>종목 등록은 최대 50개로 제한됩니다.</li>
          <li>서비스는 기술적 필요에 따라 일시적으로 중단될 수 있습니다.</li>
          <li>외부 API(Finnhub, Google Gemini 등)의 한도·장애로 인한 일시적 기능 제한이 있을 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제7조 (투자 관련 면책)">
        <ol>
          <li>서비스에서 제공하는 모든 분석, 점수, 알림, AI 관찰 후보 종목(이하 &quot;AI 촉&quot;), 멘토 분석, 통합 평단가 계산값 등은 AI 또는 자동 알고리즘이 생성한 참고 자료이며, 투자 자문이나 종목 추천이 아닙니다.</li>
          <li>AI 촉을 포함한 모든 종목 정보 제공은 특정 금융투자상품의 매수 또는 매도를 권유하지 않으며, 그 결과에 대한 어떠한 보장도 하지 않습니다.</li>
          <li>제공되는 정보의 정확성, 완전성, 적시성을 보증하지 않습니다. AI는 학습 데이터의 한계로 잘못된 정보를 생성할 수 있습니다.</li>
          <li>신규 상장(IPO) 종목은 상장 후 12개월 이내에는 시계열 데이터가 부족해 분석 정확도가 낮을 수 있으며, 이 경우 별도 안내가 표시됩니다.</li>
          <li>증권사별 자산 통합 및 평단가 계산은 사용자가 직접 입력한 정보를 기반으로 한 추정값이며, 실제 증권사 표시값과 다를 수 있습니다. 정확한 잔고 확인은 각 증권사 앱을 이용해주세요.</li>
          <li>과거 실적은 미래 수익을 보장하지 않습니다.</li>
          <li>투자 판단 및 그에 따른 이익이나 손실에 대한 책임은 전적으로 이용자에게 있습니다.</li>
          <li>서비스는 투자 결정 전 금융 전문가와 상담할 것을 권장합니다.</li>
          <li>서비스의 AI 멘토 캐릭터는 가상의 분석 도구이며, 실존 인물과 무관합니다.</li>
        </ol>
      </Section>

      <Section title="제8조 (시세 정보)">
        서비스에서 제공하는 시세 정보는 약 15분 지연된 데이터입니다. 미국 종목은 Finnhub, 한국 종목(KS/KQ)은 별도 데이터 소스를 통해 제공되며, 데이터 소스의 한계로 일부 종목은 시세가 제공되지 않을 수 있습니다. 정확한 실시간 시세 확인은 각 증권사 앱을 이용해주세요.
      </Section>

      <Section title="제9조 (지식재산권)">
        <ol>
          <li>서비스의 디자인, 코드, 브랜드, 콘텐츠에 대한 지식재산권은 서비스 운영자에게 있습니다.</li>
          <li>이용자가 서비스를 통해 생성한 포트폴리오 데이터에 대한 권리는 이용자에게 있습니다.</li>
        </ol>
      </Section>

      <Section title="제10조 (금지 행위)">
        이용자는 다음 행위를 해서는 안 됩니다.
        <ol>
          <li>서비스를 이용한 자동화된 대량 데이터 수집(크롤링/스크래핑)</li>
          <li>서비스의 보안 체계를 우회하거나 파괴하는 행위</li>
          <li>타인의 계정을 부정하게 사용하는 행위</li>
          <li>서비스를 이용하여 불법적인 행위를 하는 것</li>
          <li>AI 응답을 가공하여 마치 자격 있는 투자 자문처럼 제3자에게 전달하는 행위</li>
        </ol>
      </Section>

      <Section title="제11조 (서비스 중단)">
        서비스는 천재지변, 시스템 장애, 외부 API 장애 등 불가피한 사유로 서비스가 중단될 수 있으며, 이에 대해 사전 고지가 어려울 수 있습니다.
      </Section>

      <Section title="제12조 (손해배상의 제한)">
        서비스는 무료(베타 단계)로 제공되는 정보 서비스이며, 서비스 이용으로 발생한 직접적·간접적 손해에 대해 책임을 지지 않습니다. 단, 서비스의 고의 또는 중과실로 인한 경우는 예외로 합니다.
      </Section>

      <Section title="제13조 (분쟁 해결)">
        <ol>
          <li>서비스와 이용자 간의 분쟁은 대한민국 법률에 따라 해결합니다.</li>
          <li>관할 법원은 서비스 운영자의 주소지를 관할하는 법원으로 합니다.</li>
        </ol>
      </Section>

      <Section title="제14조 (알림 옵트인)">
        <ol>
          <li>이용자는 푸시 알림(웹 푸시) 및 이메일 알림(모닝 브리프, 월말 회고 등)을 옵트인 방식으로 수신할 수 있습니다.</li>
          <li>알림은 언제든 프로필 메뉴 또는 알림 설정에서 해제할 수 있습니다.</li>
          <li>이메일 알림은 각 메일 하단의 &quot;수신 거부&quot; 링크를 통해서도 즉시 해제할 수 있습니다.</li>
          <li>서비스는 알림 발송 기록(어떤 알림이 언제 누구에게 발송되었는지)을 일정 기간 보관하며, 이는 서비스 품질 개선과 분쟁 시 증거 자료로 사용됩니다.</li>
        </ol>
      </Section>

      <Section title="제15조 (베타 서비스 특수 조항)">
        <ol>
          <li>본 서비스는 현재 베타 단계로, 모든 기능이 무료로 제공됩니다.</li>
          <li>베타 기간 중 기능, UI, 데이터 모델, 한도 정책 등이 사전 고지 없이 변경될 수 있습니다.</li>
          <li>베타 기간 중 데이터 보존을 보증하지 않습니다. 단, 사용자가 직접 입력한 포트폴리오 데이터는 최선을 다해 보존합니다.</li>
          <li>정식 서비스 전환 시 일부 기능이 유료(PRO)로 전환될 수 있으며, 그 경우 사전 고지 후 이용자가 선택할 수 있습니다. AI 촉(관찰 후보) 기능은 영구 무료를 원칙으로 합니다.</li>
          <li>베타 사용자에 대한 별도 혜택(영구 할인 등)이 제공될 수 있으며, 그 내용은 별도 공지합니다.</li>
        </ol>
      </Section>

      <Section title="제16조 (연락처)">
        서비스명: 주비<br />
        운영자: 한식우<br />
        이메일: sunu.develop@gmail.com
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary, #191F28)' }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}
