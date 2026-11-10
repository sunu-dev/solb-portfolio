import type { Metadata } from 'next';
import DesignSystem from './DesignSystem';

export const metadata: Metadata = {
  title: '주비 디자인 | 화면과 컴포넌트',
  description: '주비의 색, 글자, 손그림과 실제 화면 컴포넌트를 함께 살펴보는 디자인 작업실.',
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <DesignSystem />;
}
