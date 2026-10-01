import styles from './HealthInsight.module.css';

export default function HealthInsight({ title, children }: { title: string; children: React.ReactNode }) {
  return <aside className={styles.insight} aria-label="포트폴리오 점검 안내">
    <h3>{title}</h3>
    <p>{children}</p>
  </aside>;
}
