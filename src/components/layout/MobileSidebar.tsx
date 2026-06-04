'use client';

import BottomSheet from '@/components/common/BottomSheet';
import FeatureDirectory from './FeatureDirectory';
import BadgeSection from '@/components/portfolio/BadgeSection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 전체 메뉴 시트 — 모바일 하단 네비 '더보기' + PC 헤더 '전체' 공용 진입점(IA P1-a).
 * 기존엔 RightSidebar(관심종목·알림)를 복제했으나, 관심종목=포트폴리오 탭 / 알림=벨(MobileAlertSheet)
 * / AI촉=인사이트 탭으로 도달 가능하므로 중복을 제거하고 카테고리형 기능 디렉터리로 승격.
 */
export default function MobileSidebar({ isOpen, onClose }: Props) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="85vh"
      paddingBottom="calc(80px + env(safe-area-inset-bottom, 0px))"
    >
      <div style={{ paddingLeft: 20, paddingRight: 20 }}>
        <FeatureDirectory onNavigate={onClose} />
        <div style={{ marginTop: 28 }}>
          <BadgeSection />
        </div>
      </div>
    </BottomSheet>
  );
}
