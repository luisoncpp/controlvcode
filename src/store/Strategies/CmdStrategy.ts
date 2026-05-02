import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class CmdStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    return await invoke('execute_bash_command', { command: node.payload });
  }
}
