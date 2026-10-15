import { Fragment } from "react";
import { LEARNING_TERMS } from "@/config/stockLearningGraph";
import ReadingText from "@/components/common/ReadingText";
import styles from "./StockLearning.module.css";

/** At most two meaningful links per paragraph keeps prose readable. */
export default function LearningText({
  text,
  current,
  onOpen,
}: {
  text: string;
  current: string;
  onOpen: (id: string) => void;
}) {
  const matches = LEARNING_TERMS.filter(([, id]) => id !== current)
    .flatMap(([word, id]) => {
      const index = text.indexOf(word);
      return index < 0 ? [] : [{ word, id, index }];
    })
    .sort((a, b) => a.index - b.index || b.word.length - a.word.length);
  const chosen: typeof matches = [];
  const seen = new Set<string>();
  let end = 0;
  for (const match of matches) {
    if (chosen.length === 2) break;
    if (match.index < end || seen.has(match.id)) continue;
    chosen.push(match);
    seen.add(match.id);
    end = match.index + match.word.length;
  }
  let from = 0;
  return (
    <>
      {chosen.map((match) => {
        const before = text.slice(from, match.index);
        from = match.index + match.word.length;
        return (
          <Fragment key={match.index}>
            <ReadingText>{before}</ReadingText>
            <button
              type="button"
              className={styles.termLink}
              data-learning-term={match.id}
              onClick={() => onOpen(match.id)}
              aria-label={`${match.word} 설명으로 이어 읽기`}
            >
              {match.word}
            </button>
          </Fragment>
        );
      })}
      <ReadingText>{text.slice(from)}</ReadingText>
    </>
  );
}
