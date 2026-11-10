import type { Metadata } from 'next';
import DesignSystem from '../brand-preview/design-system/DesignSystem';

export const metadata: Metadata = {
  title: '주비 디자인 | 화면과 컴포넌트',
  description: '주비의 디자인 아이덴티티와 공통 화면 기준을 살펴보는 작업실.',
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  return <DesignSystem />;
}
