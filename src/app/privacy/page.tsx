import { PRIVACY_VERSION, PRIVACY_EFFECTIVE_DATE } from '@/config/legalVersions';

export const metadata = {
  title: '주비 — 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px', fontFamily: "'Pretendard Variable', sans-serif", background: 'var(--bg, #fff)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #191F28)' }}>개인정보처리방침</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 4 }}>시행일: {PRIVACY_EFFECTIVE_DATE} ({PRIVACY_VERSION})</p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 24 }}>본 서비스는 현재 <strong style={{ color: '#3182F6' }}>베타 단계</strong>로, 무료로 제공됩니다.</p>

      <Section title="1. 개인정보처리방침의 목적">
        주비(이하 &quot;서비스&quot;)는 개인정보보호법에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하게 처리하기 위해 다음과 같은 처리방침을 두고 있습니다.
      </Section>

      <Section title="2. 수집하는 개인정보">
        서비스는 다음 정보를 수집합니다.
        <ul>
          <li><strong>소셜 로그인 정보</strong>: 이메일, 이름, 프로필 사진 (Google/Kakao OAuth 제공)</li>
          <li><strong>성인 확인 정보</strong>: 만 18세 이상 확인 여부, 동의 버전·시각. 입력한 생년월일은 브라우저에서 확인에만 사용하고 저장하거나 서버·외부 서비스로 전송하지 않음</li>
          <li><strong>포트폴리오 데이터</strong>: 사용자가 직접 입력한 종목 코드, 보유 수량, 평단가, 메모, 증권사·계좌 종류</li>
          <li><strong>OCR 이미지</strong>: 현재 스크린샷 가져오기 기능을 비활성화하여 수집하거나 외부 AI로 전송하지 않음</li>
          <li><strong>AI 사용 기록</strong>: AI 분석/AI 촉 호출 시각, 일별 누적 카운트, 멘토 ID, 사용한 AI 모델</li>
          <li><strong>피드백 데이터</strong>: AI 추천에 대한 1탭 피드백(👍/👎), priorityScore, 시점</li>
          <li><strong>알림 옵트인</strong>: 푸시 구독 정보(endpoint, 공개 키), 이메일 구독 여부(모닝브리프·월말 회고), 옵트인 시점</li>
          <li><strong>알림 발송 로그</strong>: 어떤 알림이 언제 누구에게 발송되었는지(분쟁 증거)</li>
          <li><strong>멤버십 등급</strong>: Free / PRO 구분, 등급 변경 이력</li>
          <li><strong>온보딩·투어 이벤트</strong>: 단계별 도달·이탈, 도움말 페이지 열람 여부 (UX 개선용)</li>
          <li><strong>로그인 스트릭</strong>: 연속 접속 일수</li>
          <li><strong>자동 수집 정보</strong>: IP 주소, 접속 시간, 브라우저/OS 정보, 에러 로그</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 수집 및 이용 목적">
        <ul>
          <li>포트폴리오 데이터 저장 및 기기 간 동기화</li>
          <li>만 18세 이상 이용 자격 확인 및 동의 증거 관리</li>
          <li>공개 시장정보 기반 AI 해설 제공 및 사용량 한도 관리</li>
          <li>맞춤 알림(푸시·이메일) 발송 및 발송 결과 추적</li>
          <li>서비스 개선, 오류 분석, A/B 테스트 (priorityScore 등)</li>
          <li>이용자 식별, 부정 이용 방지, 컴플라이언스 대응</li>
          <li>베타 사용자에 대한 정식 서비스 전환 안내</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 보유 및 이용 기간">
        이용자의 개인정보는 서비스 이용 기간 동안 보유하며, 회원 탈퇴(계정 삭제) 시 지체 없이 파기합니다. 일부 항목은 별도의 보유 기간이 적용됩니다:
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light, #E5E8EB)' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>데이터</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>알림 발송 로그</td>
              <td style={{ padding: '8px 4px' }}>발송 후 365일 (컴플라이언스 분쟁 대응)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>푸시 구독 정보</td>
              <td style={{ padding: '8px 4px' }}>옵트인 후 무효 응답 발견 시 즉시 삭제</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>AI 피드백 (👍/👎)</td>
              <td style={{ padding: '8px 4px' }}>회원 탈퇴 시 삭제</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>OCR 원본 이미지</td>
              <td style={{ padding: '8px 4px' }}>현재 기능 비활성화 — 미수집·미전송</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 4px' }}>회원 탈퇴 시 그 외 모든 데이터</td>
              <td style={{ padding: '8px 4px' }}>탈퇴 즉시 삭제</td>
            </tr>
          </tbody>
        </table>
        <br />
        <strong>파기 절차</strong>: 이용자가 계정 삭제를 요청하면 서비스 데이터베이스의 사용자 연결 레코드를 삭제하거나 재식별할 수 없도록 연결을 제거하고, 브라우저 로컬 스토리지 데이터를 초기화합니다. 외부 수탁업체가 처리한 데이터는 각 업체의 계약·보유 정책에 따라 파기됩니다.
        <br />
        <strong>파기 방법</strong>: 전자적 파일은 기록을 재생할 수 없는 기술적 방법으로 삭제합니다.
      </Section>

      <Section title="5. 개인정보 처리 위탁">
        서비스는 원활한 운영을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light, #E5E8EB)' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>수탁업체</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>위탁 업무</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>서버 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Supabase Inc.</td>
              <td style={{ padding: '8px 4px' }}>인증, 데이터베이스 저장</td>
              <td style={{ padding: '8px 4px' }}>대한민국 — 서울 리전(ap-northeast-2)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Vercel Inc.</td>
              <td style={{ padding: '8px 4px' }}>웹 호스팅, API 실행, 에러 로그</td>
              <td style={{ padding: '8px 4px' }}>미국</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Google LLC</td>
              <td style={{ padding: '8px 4px' }}>공개 시장정보 AI 해설 (Gemini API) — OCR은 현재 비활성화</td>
              <td style={{ padding: '8px 4px' }}>미국 등 Google 처리 지역 — 종목·공개 시세·지표·뉴스만 전송. 평단·수량·목표·메모는 전송하지 않음</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Anthropic PBC</td>
              <td style={{ padding: '8px 4px' }}>공개 시장정보 AI 해설 백업 (Claude API, Gemini 장애 시)</td>
              <td style={{ padding: '8px 4px' }}>미국 — 종목·공개 시세·지표·뉴스만 전송, 개인 보유정보·개인식별정보 미포함</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Finnhub Inc.</td>
              <td style={{ padding: '8px 4px' }}>시세·기본 재무 데이터 제공</td>
              <td style={{ padding: '8px 4px' }}>미국 — 종목 코드만 전송, 개인식별정보 미포함</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Resend, Inc.</td>
              <td style={{ padding: '8px 4px' }}>이메일 알림 발송 (모닝브리프, 월말 회고)</td>
              <td style={{ padding: '8px 4px' }}>미국 — 옵트인한 이용자의 이메일·발송 내용</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
              <td style={{ padding: '8px 4px' }}>Web Push 제공자</td>
              <td style={{ padding: '8px 4px' }}>브라우저 푸시 알림 전달 (FCM/APNs 등 브라우저별 상이)</td>
              <td style={{ padding: '8px 4px' }}>각 브라우저 제공사 — 푸시 endpoint·암호화된 페이로드만 전송</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 4px' }}>OpenExchangeRates</td>
              <td style={{ padding: '8px 4px' }}>USD/KRW 환율 데이터</td>
              <td style={{ padding: '8px 4px' }}>미국 — 개인식별정보 미포함</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="6. 개인정보의 국외 이전">
        서비스는 위 수탁업체 중 일부를 통해 이용자의 데이터가 국외에서 처리되도록 합니다. Supabase의 주 데이터베이스는 대한민국 서울 리전에 있습니다.
        <ul>
          <li><strong>이전되는 항목</strong>: 이메일·발송 내용(Resend), AI 해설 요청 데이터(Google, Anthropic — 종목·공개 시세·지표·뉴스만 해당하며 개인 보유정보와 OCR 이미지는 제외), 푸시 endpoint와 암호화된 알림 내용(Web Push 제공자)</li>
          <li><strong>이전 국가</strong>: 미국 등 각 수탁업체의 처리 지역 (Web Push는 브라우저 제공사 정책에 따라 다름)</li>
          <li><strong>이전 일시 및 방법</strong>: 서비스 이용 시 네트워크를 통한 실시간 전송</li>
          <li><strong>이전받는 자의 개인정보 이용 목적</strong>: 위 제5조의 위탁 업무 수행</li>
          <li><strong>이전받는 자의 보유 및 이용 기간</strong>: 위탁 계약 종료 시 또는 이용자 삭제 요청 시까지</li>
        </ul>
      </Section>

      <Section title="7. 이용자의 권리와 행사 방법">
        <ul>
          <li><strong>열람 및 수정</strong>: 서비스 내에서 포트폴리오 데이터를 직접 열람·수정할 수 있습니다.</li>
          <li><strong>알림 수신 거부</strong>: 푸시 알림은 알림 설정에서, 이메일 알림은 메일 하단의 &quot;수신 거부&quot; 링크에서 즉시 해제할 수 있습니다.</li>
          <li><strong>계정 삭제</strong>: 프로필 메뉴 &gt; 계정 삭제를 통해 모든 데이터를 즉시 삭제할 수 있습니다.</li>
          <li><strong>동의 철회</strong>: 계정 삭제를 통해 개인정보 수집 및 이용에 대한 동의를 철회할 수 있습니다.</li>
          <li><strong>문의</strong>: 아래 개인정보보호 책임자에게 이메일로 요청할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="8. 자동 수집 장치의 설치·운영 및 거부">
        서비스는 쿠키(Cookie)를 사용하지 않습니다. 다음의 브라우저 저장소를 이용 편의를 위해 사용합니다:
        <ul>
          <li><strong>Local Storage</strong>: 포트폴리오 캐시, 시세 캐시, 온보딩 진행 상태, 투어 진행 여부, 환율 캐시</li>
          <li><strong>Service Worker Cache (PWA)</strong>: 정적 리소스 캐시 (오프라인 동작용)</li>
          <li><strong>IndexedDB</strong>: 사용 안 함</li>
        </ul>
        브라우저 설정 &gt; 사이트 데이터 삭제를 통해 언제든 삭제할 수 있습니다.
      </Section>

      <Section title="9. 보안 조치">
        <ul>
          <li>HTTPS 암호화 통신 적용</li>
          <li>Supabase Row Level Security (RLS) 정책 적용 — 이용자가 본인 데이터만 접근 가능</li>
          <li>외부 시세·AI 서비스 API 키는 서버 환경변수로 관리하며, 조회 요청은 모두 서버를 거칩니다</li>
          <li>실시간 시세 구독(WebSocket)에 한해 로그인 이용자에게 단일 접속 토큰을 발급하며, 브라우저 저장소에는 보관하지 않습니다</li>
          <li>서버 인증 토큰 검증을 통한 접근 제어</li>
          <li>VAPID 푸시 키 서버 보관, 클라이언트에는 공개 키만 노출</li>
          <li>알림 발송 로그·AI 사용 기록은 운영자만 접근 가능 (admin RLS)</li>
          <li>관리자 대시보드는 별도 권한 검증 (verifyAdmin)</li>
        </ul>
      </Section>

      <Section title="10. 개인정보보호 책임자">
        <ul>
          <li>성명: 한식우</li>
          <li>직위: 대표</li>
          <li>이메일: sunu.develop@gmail.com</li>
        </ul>
      </Section>

      <Section title="11. 베타 서비스 특수 사항">
        <ul>
          <li>본 서비스는 현재 베타 단계로, 데이터 수집 항목이 정식 출시 전까지 변경될 수 있습니다.</li>
          <li>현재 무료 Gemini API 운영 기준에 따라 AI에는 공개 시장정보만 전송합니다. Google의 무료 서비스 약관상 전송 콘텐츠가 제품 개선 및 품질 검토에 사용될 수 있으므로, 평단·수량·목표·메모와 OCR 이미지는 전송하지 않습니다.</li>
          <li>Gemini API 제공 조건에 따라 만 18세 미만은 서비스에 가입하거나 이용할 수 없습니다.</li>
          <li>스크린샷 가져오기는 개인정보 보호 기준을 충족한 AI 처리 환경이 준비될 때까지 제공하지 않습니다.</li>
          <li>변경 사항은 이 처리방침 갱신 및 서비스 내 공지로 안내합니다.</li>
          <li>베타 기간 중에도 위 4조의 보유 기간·파기 절차는 동일하게 적용됩니다.</li>
        </ul>
      </Section>

      <Section title="12. 개인정보처리방침 변경">
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
