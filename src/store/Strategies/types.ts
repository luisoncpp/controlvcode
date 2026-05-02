import { ActionNode, ExecutionResult } from '../../types';

/**
 * Contrato base para todas las estrategias de ejecución.
 * Cada nueva etiqueta XML solo necesita implementar esta interfaz
 * y registrarse en el mapa de estrategias.
 */
export interface ActionStrategy {
  execute(node: ActionNode): Promise<ExecutionResult>;
}
