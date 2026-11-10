import { Fragment } from "react";
import { learningTermLinks } from "@/lib/learningNavigation";
import FinancialText from "@/components/common/FinancialText";
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
  const chosen = learningTermLinks(text, current);
  return (
    <>
      {chosen.map((match, index) => {
        const previous = chosen[index - 1];
        const before = text.slice(previous ? previous.index + previous.word.length : 0, match.index);
        return (
          <Fragment key={match.index}>
            <FinancialText current={`lesson-${current}`}>{before}</FinancialText>
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
      <FinancialText current={`lesson-${current}`}>{text.slice(chosen.length ? chosen[chosen.length - 1].index + chosen[chosen.length - 1].word.length : 0)}</FinancialText>
    </>
  );
}
