export const OPEN_DICTIONARY_EVENT = 'open-stock-dictionary';
/** Same account-backed dictionary from the menu, book icon and term dialog. */
export function openStockDictionary(termId?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_DICTIONARY_EVENT, { detail: { termId } }));
}
