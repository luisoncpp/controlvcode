import type { RawTag } from '../types';
import { getInlineBacktickRanges } from '../backtickRanges';
import { advanceIndexPastProtectedRanges } from './textUtils';
import { tryParseTagAt } from './tagParser';

export function scanTags(rawText: string): RawTag[] {
  const protectedRanges = getInlineBacktickRanges(rawText);
  const tags: RawTag[] = [];
  let index = 0;

  while (index < rawText.length) {
    index = advanceIndexPastProtectedRanges(index, protectedRanges);
    if (index >= rawText.length) break;

    if (rawText[index] !== '<') {
      index++;
      continue;
    }

    const parsed = tryParseTagAt({
      text: rawText,
      openingBracketIndex: index,
      protectedRanges,
    });
    if (parsed) {
      tags.push(parsed.tag);
      index = parsed.nextIndex;
    } else {
      index++; // avanzar para no quedar atrapado
    }
  }

  return tags;
}
