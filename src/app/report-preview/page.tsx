import { notFound } from 'next/navigation';
import InsightsSection from '@/components/insights/InsightsSection';
import EconomicCalendar from '@/components/economy/EconomicCalendar';
import BriefingDialog from '@/components/portfolio/BriefingDialog';

export default function ReportPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 80px'}}>
    <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:20}}>로컬 미리보기 · 운영에는 아직 반영되지 않았어요</p>
    <InsightsSection />
    <EconomicCalendar />
    <BriefingDialog ready={false} />
  </main>;
}
