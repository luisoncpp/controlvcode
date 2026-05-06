
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

/**
 * Estrategia para tags que fallaron al parsearse.
 * No ejecuta nada destructivo — solo muestra un error visible en la cola.
 */
export class ParseErrorStrategy implements ActionStrategy {
  async execute(node: ActionNode): Promise<ExecutionResult> {
    const rawSnippet = node.content
      ? `\n\nContenido crudo del tag:\n${node.content}`
      : '';

    return {
      stdout: '',
      stderr: `${node.payload}${rawSnippet}`,
      exitCode: 1,
    };
  }
}
