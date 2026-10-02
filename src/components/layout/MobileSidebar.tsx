'use client';

import BottomSheet from '@/components/common/BottomSheet';
import FeatureDirectory from './FeatureDirectory';
import BadgeSection from '@/components/portfolio/BadgeSection';
import { ChevronRight } from 'lucide-react';
import styles from './FeatureDirectory.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** 모바일 하단 메뉴와 데스크톱 헤더에서 함께 사용하는 전체 메뉴. */
export default function MobileSidebar({ isOpen, onClose }: Props) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="전체 메뉴"
      maxHeight="90dvh"
      paddingBottom="calc(24px + env(safe-area-inset-bottom, 0px))"
      desktopVariant
    >
      <div className={styles.shell}>
        <FeatureDirectory onNavigate={onClose} />
        {/* 배지는 PC에선 우측 사이드바에 상시 노출되므로 시트에선 모바일만(중복 방지) */}
        <details className={styles.badges}>
          <summary>내 뱃지 보기<ChevronRight size={18} aria-hidden="true" /></summary>
          <div className={styles.badgeContent}><BadgeSection /></div>
        </details>
      </div>
    </BottomSheet>
  );
}
