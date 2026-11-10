/** Automatic notices must not take over another task. Explicit opens are separate. */
export function canShowAutomaticPrompt(doc: Document = document): boolean {
  if (doc.visibilityState !== 'visible') return false;
  if (doc.querySelector('[aria-modal="true"], dialog[open]')) return false;
  return !doc.activeElement?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
