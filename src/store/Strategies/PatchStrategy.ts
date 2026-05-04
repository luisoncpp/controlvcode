
import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class PatchStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const result: { hunks_applied: number; lines_added: number; lines_removed: number } =
      await invoke('patch_file', { path: node.payload, diffText: node.content ?? '' });
    return {
      stdout: `Patch applied to ${node.payload}: ${result.hunks_applied} hunk(s), +${result.lines_added} -${result.lines_removed} line(s).`,
      stderr: '',
      exitCode: 0,
    };
  }
}
