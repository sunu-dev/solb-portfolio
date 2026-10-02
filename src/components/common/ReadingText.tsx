import { Fragment } from 'react';

/** Preserve common Korean predicates without measuring text or forcing line breaks. */
export default function ReadingText({ children }: { children: string }) {
  const phrases = /\S+\s+수\s+(?:있어요|없어요|있고|없고|있어|없어)/g;
  const parts = [];
  let from = 0;
  for (const match of children.matchAll(phrases)) {
    const index = match.index;
    parts.push(<Fragment key={`text-${index}`}>{children.slice(from, index)}</Fragment>);
    parts.push(<span key={`phrase-${index}`} className="reading-phrase">{match[0]}</span>);
    from = index + match[0].length;
  }
  parts.push(<Fragment key="tail">{children.slice(from)}</Fragment>);
  return <>{parts}</>;
}
