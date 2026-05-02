import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class TreeStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    return await invoke('list_directory', { path: node.payload });
  }
}
