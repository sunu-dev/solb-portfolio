/** Break a long explanation into readable paragraphs without rewriting its words or facts. */
export function answerParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).flatMap(block => {
    if (block.length < 240 || typeof Intl.Segmenter === 'undefined') return [block];
    const sentences = [...new Intl.Segmenter('ko', { granularity: 'sentence' }).segment(block)].map(item => item.segment);
    const paragraphs: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (current.length >= 120) { paragraphs.push(current); current = ''; }
      current += sentence;
    }
    if (current) paragraphs.push(current);
    return paragraphs;
  }).filter(paragraph => paragraph.trim().length > 0);
}
