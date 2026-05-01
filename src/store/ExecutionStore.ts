import { signal, computed } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { ActionNode, ExecutionResult } from "../types";
import { LLMParser } from "./LLMParser";

export class ExecutionStore {
  public rawInput = signal("");
  public nodes = signal<ActionNode[]>([]);
  public feedbackPrompt = computed(() => this.generateFeedback());
  public activeIndex = computed(() =>
    this.nodes.value.findIndex(n => n.status === 'pending' || n.status === 'error')
  );
  public autoCopy = signal(false);

  public processInput(text: string) {
    this.rawInput.value = text;
    this.nodes.value = LLMParser.parse(text);
  }

  public async executeNode(index: number) {
    const nodes = [...this.nodes.value];
    const node = nodes[index];
    
    if (node.status === 'running') return;

    node.status = 'running';
    this.nodes.value = [...nodes]; 

    try {
      let result: ExecutionResult;
      if (node.type === 'cmd') {
        result = await invoke('execute_bash_command', { command: node.payload });
      } else if (node.type === 'file') {
        result = await invoke('write_file', { path: node.payload, content: node.content ?? '' });
      } else if (node.type === 'tree') {
        result = await invoke('list_directory', { path: node.payload });
      } else {
        throw new Error(`Tipo de acción desconocido: ${node.type}`);
      }
      
      node.result = result;
      node.status = result.exitCode === 0 ? 'success' : 'error';
    } catch (e) {
      node.status = 'error';
      node.result = { stdout: '', stderr: String(e), exitCode: -1 };
    }

    this.nodes.value = [...nodes];
    this.tryAutoCopy();
  }

  public skipNode(index: number) {
    const nodes = [...this.nodes.value];
    nodes[index].status = 'skipped';
    this.nodes.value = nodes;
    this.tryAutoCopy();
  }

  public async copyFeedbackToClipboard(): Promise<boolean> {
    try {
      await window.navigator.clipboard.writeText(this.feedbackPrompt.value);
      return true;
    } catch {
      return false;
    }
  }

  private tryAutoCopy() {
    if (this.autoCopy.value) {
      this.copyFeedbackToClipboard();
    }
  }

  private generateFeedback(): string {
    const executedNodes = this.nodes.value.filter(n => n.result !== null);
    if (executedNodes.length === 0) return "";

    let xml = "<execution_results>\n";
    for (const node of executedNodes) {
      const { payload, result } = node;
      const status = result!.exitCode === 0 ? "success" : "error";
      
      const safePayload = payload.replace(/"/g, '&quot;');
      
      xml += `  <result command="${safePayload}" status="${status}">\n`;
      if (result!.stdout) xml += `    <stdout>\n${result!.stdout}\n    </stdout>\n`;
      if (result!.stderr) xml += `    <stderr>\n${result!.stderr}\n    </stderr>\n`;
      xml += `  </result>\n`;
    }
    xml += "</execution_results>";
    return xml;
  }
}