import { invoke } from '@tauri-apps/api/core';

export interface ReplaceOptions {
  occurrence?: 'first' | 'all';
}

export async function executeReplace(
  path: string,
  oldStr: string,
  newStr: string,
  options: ReplaceOptions = {}
): Promise<string> {
  const occurrence = options.occurrence ?? 'first';
  const result: { replaced: number } = await invoke('replace_in_file', {
    path,
    oldStr,
    newStr,
    all: occurrence === 'all',
  });
  return `Replaced ${result.replaced} occurrence(s) in ${path}.`;
}
