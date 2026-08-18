interface Props {
  variant?: 'header' | 'hero' | 'modal' | 'loading';
}

export default function JoobiLockup({ variant = 'header' }: Props) {
  return (
    <span className={`joobi-lockup joobi-lockup--${variant}`} aria-label="나만의 주식비서">
      <span className="joobi-lockup__visual" aria-hidden="true">
        <span className="joobi-lockup__prefix">나만의</span>
        <span className="joobi-lockup__brand-letter">주</span>
        <span className="joobi-lockup__minor-letter joobi-lockup__minor-letter--middle">식</span>
        <span className="joobi-lockup__brand-letter">비</span>
        <span className="joobi-lockup__minor-letter joobi-lockup__minor-letter--suffix">서</span>
      </span>
    </span>
  );
}
