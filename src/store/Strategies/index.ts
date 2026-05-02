import { ActionType } from '../../types';
import { ActionStrategy } from './types';
import { CmdStrategy } from './CmdStrategy';
import { FileStrategy } from './FileStrategy';
import { TreeStrategy } from './TreeStrategy';
import { ReadStrategy } from './ReadStrategy';
import { ReplaceStrategy } from './ReplaceStrategy';

/**
 * Registro de estrategias. 
 * Para añadir un nuevo comando, crea una clase que implemente ActionStrategy
 * y regístrala aquí con su tipo correspondiente.
 */
export const strategies: Record<ActionType, ActionStrategy> = {
  cmd: new CmdStrategy(),
  file: new FileStrategy(),
  tree: new TreeStrategy(),
  read: new ReadStrategy(),
  replace: new ReplaceStrategy(),
};

export type { ActionStrategy } from './types';
