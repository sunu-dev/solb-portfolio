import readingUI from '../ui/ReadingUI.module.css';

export default function PortfolioPrivacyNotice() {
  return (
    <details style={{ margin: '14px 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.75 }}>
      <summary className={readingUI.disclosure}>내 투자 기록은 어디에 저장되나요?</summary>
      <p>로그인하면 등록한 종목·수량·평균 매수가와 일일 기록·복구 지점을 Supabase 데이터베이스에 계정별로 저장해요. 이 브라우저에도 사본이 남아요.</p>
      <p>통신은 HTTPS로 암호화하고, 일반 이용자는 자기 계정의 기록만 읽고 변경하도록 접근을 제한해요. 다만 운영 권한으로도 읽을 수 없는 종단간 암호화 방식은 아니에요.</p>
      <p>종목 AI 해설에는 공개 시세·지표·뉴스를 사용하며, 보유 수량·평균 매수가·개인 메모는 보내지 않아요. 증권사 계정이나 계좌 비밀번호를 연결하는 기능은 없어요.</p>
      <p>CSV·JSON 파일은 이 기기에서 읽어요. 가져오기를 승인한 기록은 로그인 상태에서 클라우드에 동기화돼요. 내려받은 파일에는 투자 정보가 있으니 공유에 주의해주세요.</p>
      <p><a href="/help#privacy" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>내 정보와 기록 보호 Q&amp;A</a></p>
      <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>개인정보 처리 방식 자세히 보기</a>
    </details>
  );
}
