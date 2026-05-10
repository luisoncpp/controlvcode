
const MENTION_REGEX = /@([a-zA-Z0-9_./\-]+)/g;
const MATCH_INDEX = 1;

export function extractFileMentions(fileContent: string): string[] {
  const extractedMentions: string[] = [];
  let currentMatch: RegExpExecArray | null;

  while ((currentMatch = MENTION_REGEX.exec(fileContent)) !== null) {
    let extractedPath = currentMatch[MATCH_INDEX];
    
    if (extractedPath.endsWith('.')) {
      extractedPath = extractedPath.slice(0, -1);
    }
    
    extractedMentions.push(extractedPath);
  }

  return extractedMentions;
}
