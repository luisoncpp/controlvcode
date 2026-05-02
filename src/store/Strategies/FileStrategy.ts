import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class FileStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    return await invoke('write_file', { path: node.payload, content: node.content ?? '' });
  }
}
