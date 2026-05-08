
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
): Promise<{ output: string, matches: number }> {
  const occurrence = options.occurrence ?? 'first';
  const result: { replaced: number } = await invoke('replace_in_file', {
    path,
    oldStr,
    newStr,
    all: occurrence === 'all',
  });
  return { 
    output: `Replaced ${result.replaced} occurrence(s) in ${path}.`,
    matches: result.replaced
  };
}

export class ReplaceStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const oldStr = node.content ?? '';
    const newStr = node.newContent ?? '';

    // Guard: rechazar old vacío — coincidiría con todo y causaría daño
    if (!oldStr) {
      return {
        stdout: '',
        stderr: 'Error de seguridad: el texto a reemplazar está vacío. Operación cancelada.',
        exitCode: 1,
      };
    }

    const ropts: ReplaceOptions = {};
    if (node.options?.occurrence === 'all') ropts.occurrence = 'all';
    const { output, matches } = await executeReplace(
      node.payload,
      oldStr,
      newStr,
      ropts
    );
    return { stdout: output, stderr: '', exitCode: 0, meta: { matches } };
  }
}
