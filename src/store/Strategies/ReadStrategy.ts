import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';
import { executeRead, ReadOptions } from '../Commands/readCommand';

export class ReadStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const opts: ReadOptions = {};
    if (node.options) {
      if (node.options.start) opts.start = parseInt(node.options.start, 10);
      if (node.options.end) opts.end = parseInt(node.options.end, 10);
      if (node.options.line) opts.line = parseInt(node.options.line, 10);
      if (node.options.count) opts.count = parseInt(node.options.count, 10);
    }
    const output = await executeRead(node.payload, opts);
    return { stdout: output, stderr: '', exitCode: 0 };
  }
}
