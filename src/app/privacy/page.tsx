export const metadata = {
  title: 'SOLB — 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px', fontFamily: "'Pretendard Variable', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>개인정보처리방침</h1>
      <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 24 }}>시행일: 2026년 3월 31일</p>

      <Section title="1. 수집하는 개인정보">
        SOLB는 서비스 제공을 위해 다음 정보를 수집합니다.
        <ul>
          <li>소셜 로그인 정보: 이메일, 이름, 프로필 사진 (Google/Kakao 제공)</li>
          <li>서비스 이용 기록: 포트폴리오 데이터, AI 분석 사용 기록</li>
          <li>자동 수집: IP 주소, 접속 시간, 브라우저 정보</li>
        </ul>
      </Section>

      <Section title="2. 수집 목적">
        <ul>
          <li>포트폴리오 데이터 저장 및 기기 간 동기화</li>
          <li>AI 분석 서비스 제공 및 사용량 관리</li>
          <li>서비스 개선 및 오류 분석</li>
        </ul>
      </Section>

      <Section title="3. 보유 기간">
        회원 탈퇴 시 즉시 삭제합니다. 법령에 따른 보존 의무가 있는 경우 해당 기간 보관 후 삭제합니다.
      </Section>

      <Section title="4. 제3자 제공">
        SOLB는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 다음 서비스를 통해 데이터가 처리됩니다.
        <ul>
          <li>Supabase (데이터베이스/인증): 미국 서버</li>
          <li>Vercel (호스팅): 미국 서버</li>
          <li>Google Gemini (AI 분석): 분석 요청 시 종목 데이터 전송 (개인식별정보 미포함)</li>
        </ul>
      </Section>

      <Section title="5. 이용자의 권리">
        <ul>
          <li>포트폴리오 데이터 열람 및 수정: 서비스 내에서 직접 가능</li>
          <li>계정 삭제: 설정 메뉴에서 직접 삭제 가능 (모든 데이터 즉시 삭제)</li>
          <li>문의: 아래 연락처로 요청</li>
        </ul>
      </Section>

      <Section title="6. 보안 조치">
        <ul>
          <li>HTTPS 암호화 통신</li>
          <li>Supabase Row Level Security (RLS) 적용</li>
          <li>서버 환경변수로 API 키 관리</li>
        </ul>
      </Section>

      <Section title="7. 쿠키 및 로컬 스토리지">
        SOLB는 쿠키를 사용하지 않습니다. 브라우저 로컬 스토리지에 포트폴리오 캐시 데이터를 저장하며, 브라우저 설정에서 삭제할 수 있습니다.
      </Section>

      <Section title="8. 연락처">
        서비스명: SOLB<br />
        이메일: sunu.develop@gmail.com
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#191F28' }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#4E5968', lineHeight: 1.8 }}>{children}</div>
      <style>{`
        div ul { padding-left: 20px; margin-top: 6px; }
        div li { margin-bottom: 4px; }
      `}</style>
    </div>
  );
}
