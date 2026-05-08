import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class TreeStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const result = await invoke<ExecutionResult>('list_directory', { path: node.payload });
    const depth = node.options?.depth || 'auto';
    return {
      ...result,
      meta: { depth }
    };
  }
}
