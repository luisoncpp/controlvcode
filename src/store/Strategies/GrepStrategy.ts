import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

interface GrepOptions {
  glob?: string;
  ignoreCase?: boolean;
}

async function executeGrep(
  path: string,
  pattern: string,
  options: GrepOptions = {}
): Promise<{ output: string, matches: number }> {
  const matches: Array<{ file: string; line: number; content: string }> = await invoke('grep_in_files', {
    path,
    pattern,
    glob: options.glob ?? null,
    ignoreCase: options.ignoreCase ?? false,
  });

  if (matches.length === 0) {
    return { output: `No matches found for pattern "${pattern}" in ${path}.`, matches: 0 };
  }

  let output = '';
  for (const match of matches) {
    output += `${match.file}:${match.line}: ${match.content}\n`;
  }
  return { output: output.trimEnd(), matches: matches.length };
}

export class GrepStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const opts: GrepOptions = {};
    if (node.options?.ignore_case === 'true') opts.ignoreCase = true;
    if (node.options?.glob) opts.glob = node.options.glob;

    const { output, matches } = await executeGrep(
      node.payload,
      node.content ?? '',
      opts
    );
    return { stdout: output, stderr: '', exitCode: 0, meta: { matches } };
  }
}
