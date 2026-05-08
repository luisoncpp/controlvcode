import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class FileStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const result = await invoke<ExecutionResult>('write_file', { path: node.payload, content: node.content ?? '' });
    const bytes = new TextEncoder().encode(node.content ?? '').length;
    
    return {
      ...result,
      meta: { bytes }
    } as ExecutionResult;
  }
}
