import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

interface ReplaceOptions {
  occurrence?: 'first' | 'all';
}

async function executeReplace(
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

export class ReplaceStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const ropts: ReplaceOptions = {};
    if (node.options?.occurrence === 'all') ropts.occurrence = 'all';
    const output = await executeReplace(
      node.payload,
      node.content ?? '',
      node.newContent ?? '',
      ropts
    );
    return { stdout: output, stderr: '', exitCode: 0 };
  }
}
