
import { extractFileMentions } from './extractor';

function enqueueUnvisitedReferences(
  processingQueue: string[],
  visitedFiles: Set<string>,
  newReferences: string[]
): void {
  for (const reference of newReferences) {
    if (visitedFiles.has(reference)) continue;
    processingQueue.push(reference);
  }
}

export async function processSingleFile(
  processingQueue: string[],
  visitedFiles: Set<string>,
  readFileProvider: (filePath: string) => Promise<string>
): Promise<void> {
  const currentFilePath = processingQueue.shift();
  if (!currentFilePath) return;
  if (visitedFiles.has(currentFilePath)) return;

  visitedFiles.add(currentFilePath);

  try {
    const fileContent = await readFileProvider(currentFilePath);
    const discoveredReferences = extractFileMentions(fileContent);
    enqueueUnvisitedReferences(processingQueue, visitedFiles, discoveredReferences);
  } catch (readError) {
    return;
  }
}

export async function resolveAllDependencies(
  initialFilePaths: string[],
  readFileProvider: (filePath: string) => Promise<string>
): Promise<string[]> {
  const visitedFiles = new Set<string>();
  const processingQueue = [...initialFilePaths];

  while (processingQueue.length > 0) {
    await processSingleFile(processingQueue, visitedFiles, readFileProvider);
  }

  return Array.from(visitedFiles);
}
