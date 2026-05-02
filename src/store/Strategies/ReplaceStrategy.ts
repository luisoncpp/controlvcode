import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';
import { executeReplace, ReplaceOptions } from '../Commands/replaceCommand';

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
