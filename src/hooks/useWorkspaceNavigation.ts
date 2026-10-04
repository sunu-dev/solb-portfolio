import { useEffect } from 'react';
import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { workspaceSection, workspaceUrl } from '@/lib/workspaceNavigation';

/** Keep browser history and the workspace in agreement, including stock overlays. */
export function useWorkspaceNavigation() {
  useEffect(() => {
    let applyingLocation = false;
    let frame = 0;
    const positions = new Map<MainSection, number>();
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const restorePosition = (section: MainSection) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => window.scrollTo({ top: positions.get(section) ?? 0, behavior: 'instant' }));
      });
    };
    const apply = () => {
      const before = usePortfolioStore.getState();
      const params = new URLSearchParams(window.location.search);
      const section = workspaceSection(params);
      const symbol = params.get('stock')?.toUpperCase() || null;
      if (section !== before.currentSection) positions.set(before.currentSection, window.scrollY);
      applyingLocation = true;
      usePortfolioStore.setState({ currentSection: section, analysisSymbol: symbol });
      applyingLocation = false;
      if (section !== before.currentSection) restorePosition(section);
    };
    apply();
    const unsubscribe = usePortfolioStore.subscribe((state, previous) => {
      if (applyingLocation) return;
      const sectionChanged = state.currentSection !== previous.currentSection;
      if (!sectionChanged && state.analysisSymbol === previous.analysisSymbol) return;
      const url = workspaceUrl(window.location.href, state.currentSection, state.analysisSymbol);
      if (`${location.pathname}${location.search}${location.hash}` !== url) {
        if (sectionChanged || state.analysisSymbol) window.history.pushState(null, '', url);
        else window.history.replaceState(null, '', url);
      }
      if (sectionChanged) {
        positions.set(previous.currentSection, window.scrollY);
        restorePosition(state.currentSection);
      }
    });
    window.addEventListener('popstate', apply);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', apply);
      cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);
}
