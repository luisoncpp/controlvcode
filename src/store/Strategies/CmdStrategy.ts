import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

export class CmdStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const result = await invoke<ExecutionResult>('execute_bash_command', { command: node.payload });
    return {
      ...result,
      meta: { exit_code: result.exitCode }
    };
  }
}
