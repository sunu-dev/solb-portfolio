export const metadata = {
  title: '주비 — 이용약관',
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px', fontFamily: "'Pretendard Variable', sans-serif", background: 'var(--bg, #fff)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, color: 'var(--text-primary, #191F28)' }}>이용약관</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 24 }}>시행일: 2026년 3월 31일</p>

      <Section title="제1조 (목적)">
        이 약관은 주비(이하 &quot;서비스&quot;)가 제공하는 투자 정보 서비스의 이용 조건 및 절차, 서비스와 이용자의 권리·의무 및 책임 사항 등을 규정함을 목적으로 합니다.
      </Section>

      <Section title="제2조 (서비스의 정의)">
        서비스는 AI 기반 주식 포트폴리오 분석 정보를 제공하는 웹 애플리케이션입니다. 서비스는 투자자문업 또는 투자일임업에 해당하지 않으며, 정보 제공 목적으로만 운영됩니다.
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
          <li>주식 포트폴리오 관리 (종목 추가, 수정, 삭제)</li>
          <li>실시간 시세 정보 (15분 지연)</li>
          <li>AI 기반 기술적 분석 및 멘토 관점 분석</li>
          <li>스마트 알림 (가격 변동, 기술 지표 변화)</li>
          <li>포트폴리오 건강 점수 및 레이더 차트</li>
          <li>관련 뉴스 제공</li>
        </ol>
      </Section>

      <Section title="제6조 (서비스 이용의 제한)">
        <ol>
          <li>AI 분석 기능은 비로그인 사용자 일 3회, 로그인 사용자 일 10회로 제한됩니다.</li>
          <li>종목 등록은 최대 50개로 제한됩니다.</li>
          <li>서비스는 기술적 필요에 따라 일시적으로 중단될 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제7조 (투자 관련 면책)">
        <ol>
          <li>서비스에서 제공하는 모든 분석, 점수, 알림 등은 AI가 자동으로 생성한 참고 자료이며, 투자 자문이 아닙니다.</li>
          <li>서비스는 특정 금융투자상품의 매수 또는 매도를 권유하지 않습니다.</li>
          <li>제공되는 정보의 정확성, 완전성, 적시성을 보증하지 않습니다.</li>
          <li>과거 실적은 미래 수익을 보장하지 않습니다.</li>
          <li>투자 판단 및 그에 따른 이익이나 손실에 대한 책임은 전적으로 이용자에게 있습니다.</li>
          <li>서비스는 투자 결정 전 금융 전문가와 상담할 것을 권장합니다.</li>
          <li>서비스의 AI 캐릭터는 가상의 분석 도구이며, 실존 인물과 무관합니다.</li>
        </ol>
      </Section>

      <Section title="제8조 (시세 정보)">
        서비스에서 제공하는 시세 정보는 약 15분 지연된 데이터이며, 실시간 거래에 사용하기에 적합하지 않습니다. 정확한 시세 확인은 증권사 앱을 이용해주세요.
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
        </ol>
      </Section>

      <Section title="제11조 (서비스 중단)">
        서비스는 천재지변, 시스템 장애, 외부 API 장애 등 불가피한 사유로 서비스가 중단될 수 있으며, 이에 대해 사전 고지가 어려울 수 있습니다.
      </Section>

      <Section title="제12조 (손해배상의 제한)">
        서비스는 무료로 제공되는 정보 서비스이며, 서비스 이용으로 발생한 직접적·간접적 손해에 대해 책임을 지지 않습니다. 단, 서비스의 고의 또는 중과실로 인한 경우는 예외로 합니다.
      </Section>

      <Section title="제13조 (분쟁 해결)">
        <ol>
          <li>서비스와 이용자 간의 분쟁은 대한민국 법률에 따라 해결합니다.</li>
          <li>관할 법원은 서비스 운영자의 주소지를 관할하는 법원으로 합니다.</li>
        </ol>
      </Section>

      <Section title="제14조 (연락처)">
        서비스명: 주비<br />
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
