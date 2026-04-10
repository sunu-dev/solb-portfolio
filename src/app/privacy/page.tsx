export const metadata = {
  title: '솔비서 — 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px', fontFamily: "'Pretendard Variable', sans-serif", background: 'var(--bg, #fff)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, color: 'var(--text-primary, #191F28)' }}>개인정보처리방침</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 24 }}>시행일: 2026년 3월 31일</p>

      <Section title="1. 개인정보처리방침의 목적">
        솔비서(이하 &quot;서비스&quot;)는 개인정보보호법에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하게 처리하기 위해 다음과 같은 처리방침을 두고 있습니다.
      </Section>

      <Section title="2. 수집하는 개인정보">
        서비스는 다음 정보를 수집합니다.
        <ul>
          <li>소셜 로그인 정보: 이메일, 이름, 프로필 사진 (Google/Kakao OAuth 제공)</li>
          <li>서비스 이용 기록: 포트폴리오 데이터, AI 분석 사용 기록, 로그인 스트릭</li>
          <li>자동 수집 정보: IP 주소, 접속 시간, 브라우저 정보, 에러 로그</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 수집 및 이용 목적">
        <ul>
          <li>포트폴리오 데이터 저장 및 기기 간 동기화</li>
          <li>AI 분석 서비스 제공 및 사용량 관리</li>
          <li>서비스 개선, 오류 분석 및 안정성 확보</li>
          <li>이용자 식별 및 부정 이용 방지</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 보유 및 이용 기간">
        이용자의 개인정보는 서비스 이용 기간 동안 보유하며, 회원 탈퇴(계정 삭제) 시 지체 없이 파기합니다.
        <br /><br />
        <strong>파기 절차:</strong> 이용자가 계정 삭제를 요청하면 데이터베이스에서 해당 레코드를 즉시 삭제(DELETE)하고, 브라우저 로컬 스토리지 데이터를 초기화합니다.
        <br />
        <strong>파기 방법:</strong> 전자적 파일은 기록을 재생할 수 없는 기술적 방법으로 삭제합니다.
      </Section>

      <Section title="5. 개인정보 처리 위탁">
        서비스는 원활한 운영을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E8EB' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>수탁업체</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>위탁 업무</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>서버 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #F2F4F6' }}>
              <td style={{ padding: '8px 4px' }}>Supabase Inc.</td>
              <td style={{ padding: '8px 4px' }}>인증, 데이터베이스 저장</td>
              <td style={{ padding: '8px 4px' }}>미국</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F2F4F6' }}>
              <td style={{ padding: '8px 4px' }}>Vercel Inc.</td>
              <td style={{ padding: '8px 4px' }}>웹 호스팅, API 실행</td>
              <td style={{ padding: '8px 4px' }}>미국</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 4px' }}>Google LLC</td>
              <td style={{ padding: '8px 4px' }}>AI 분석 (Gemini API)</td>
              <td style={{ padding: '8px 4px' }}>미국 (종목 데이터만 전송, 개인식별정보 미포함)</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="6. 개인정보의 국외 이전">
        서비스는 위 수탁업체를 통해 이용자의 데이터가 미국 서버에서 처리됩니다.
        <ul>
          <li>이전되는 항목: 이메일, 포트폴리오 데이터, AI 분석 요청 데이터</li>
          <li>이전 국가: 미국</li>
          <li>이전 일시 및 방법: 서비스 이용 시 네트워크를 통한 실시간 전송</li>
          <li>이전받는 자의 개인정보 이용 목적: 위 제5조의 위탁 업무 수행</li>
          <li>이전받는 자의 보유 및 이용 기간: 위탁 계약 종료 시 또는 이용자 삭제 요청 시까지</li>
        </ul>
      </Section>

      <Section title="7. 이용자의 권리와 행사 방법">
        <ul>
          <li><strong>열람 및 수정:</strong> 서비스 내에서 포트폴리오 데이터를 직접 열람·수정할 수 있습니다.</li>
          <li><strong>계정 삭제:</strong> 프로필 메뉴 &gt; 계정 삭제를 통해 모든 데이터를 즉시 삭제할 수 있습니다.</li>
          <li><strong>동의 철회:</strong> 계정 삭제를 통해 개인정보 수집 및 이용에 대한 동의를 철회할 수 있습니다.</li>
          <li><strong>문의:</strong> 아래 개인정보보호 책임자에게 이메일로 요청할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="8. 자동 수집 장치의 설치·운영 및 거부">
        서비스는 쿠키(Cookie)를 사용하지 않습니다. 브라우저 로컬 스토리지(Local Storage)에 포트폴리오 캐시 데이터를 저장하며, 이는 서비스 이용 편의를 위한 것입니다. 브라우저 설정 &gt; 사이트 데이터 삭제를 통해 언제든 삭제할 수 있습니다.
      </Section>

      <Section title="9. 보안 조치">
        <ul>
          <li>HTTPS 암호화 통신 적용</li>
          <li>Supabase Row Level Security (RLS) 정책 적용</li>
          <li>API 키는 서버 환경변수로 관리 (클라이언트 미노출)</li>
          <li>서버 인증 토큰 검증을 통한 접근 제어</li>
        </ul>
      </Section>

      <Section title="10. 개인정보보호 책임자">
        <ul>
          <li>성명: 한식우</li>
          <li>직위: 대표</li>
          <li>이메일: sunu.develop@gmail.com</li>
        </ul>
      </Section>

      <Section title="11. 개인정보처리방침 변경">
        이 개인정보처리방침이 변경되는 경우, 변경 사항을 서비스 내 공지사항 또는 이메일을 통해 사전 고지합니다. 변경된 방침은 고지 후 7일이 경과한 날부터 효력이 발생합니다.
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
