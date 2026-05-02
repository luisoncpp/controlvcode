export type ActionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';
export type ActionType = 'cmd' | 'file' | 'tree' | 'read';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ActionNode {
  id: string;
  type: ActionType;
  payload: string;
  content?: string;
  options?: Record<string, string>;
  status: ActionStatus;
  result: ExecutionResult | null;
}
