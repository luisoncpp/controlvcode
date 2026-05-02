import type { Range } from './types';

export function getInlineBacktickRanges(text: string): Range[] {
  const ranges: Range[] = [];
  let i = 0;

  while (i < text.length) {
    if (i + 2 < text.length && text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
      i += 3;
      while (i + 2 < text.length) {
        if (text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
          i += 3;
          break;
        }
        i++;
      }
    } else if (text[i] === '`') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '`') i++;
      if (i < text.length) {
        i++;
        ranges.push({ start, end: i });
      }
    } else {
      i++;
    }
  }

  return ranges;
}
