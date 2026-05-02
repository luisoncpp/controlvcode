import { invoke } from '@tauri-apps/api/core';
import { ActionNode, ExecutionResult } from '../../types';
import { ActionStrategy } from './types';

interface ReadOptions {
  start?: number;
  end?: number;
  line?: number;
  count?: number;
}

function formatWithLineNumbers(content: string, startLine: number = 1): string {
  const lines = content.split('\n');
  return lines
    .map((line, i) => {
      const num = (startLine + i).toString().padStart(5, ' ');
      return `${num}  ${line}`;
    })
    .join('\n');
}

async function executeRead(path: string, options: ReadOptions = {}): Promise<string> {
  let start: number | undefined;
  let end: number | undefined;

  if (options.line !== undefined) {
    start = options.line;
    if (options.count !== undefined) {
      end = start + options.count - 1;
    } else {
      end = start;
    }
  } else {
    start = options.start;
    end = options.end;
  }

  const content: string = await invoke('read_file_with_line_numbers', {
    path,
    startLine: start ?? null,
    endLine: end ?? null,
  });

  if (!content) return '';

  const firstLine = start ?? 1;
  return formatWithLineNumbers(content, firstLine);
}

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
