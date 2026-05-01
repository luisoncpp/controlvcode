import { signal, Signal, computed } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { ActionNode, ExecutionResult } from "../types";
import { LLMParser } from "./LLMParser";

export class ExecutionStore {
  public rawInput: Signal<string>;
  public nodes: Signal<ActionNode[]>;
  public feedbackPrompt: Signal<string>;

  constructor() {
    this.rawInput = signal("");
    this.nodes = signal([]);
    this.feedbackPrompt = computed(() => this.generateFeedback());
  }

  public get activeIndex(): number {
    return this.nodes.value.findIndex(n => n.status === 'pending' || n.status === 'error');
  }

  public processInput(text: string) {
    this.rawInput.value = text;
    this.nodes.value = LLMParser.parse(text);
  }

  public async executeNode(index: number) {
    const nodes = [...this.nodes.value];
    const node = nodes[index];
    
    if (node.status === 'running') return;

    node.status = 'running';
    this.nodes.value = nodes; 

    try {
      const result: ExecutionResult = await invoke('execute_bash_command', { 
        command: node.payload 
      });
      
      node.result = result;
      // Ahora result.exitCode sí existe y vale 0 si es exitoso
      node.status = result.exitCode === 0 ? 'success' : 'error';
    } catch (e) {
      node.status = 'error';
      node.result = { stdout: '', stderr: String(e), exitCode: -1 };
    }

    this.nodes.value = [...nodes]; 
  }

  public skipNode(index: number) {
    const nodes = [...this.nodes.value];
    nodes[index].status = 'skipped';
    this.nodes.value = nodes;
  }

  private generateFeedback(): string {
    const executedNodes = this.nodes.value.filter(n => n.result !== null);
    if (executedNodes.length === 0) return "";

    let xml = "<execution_results>\n";
    for (const node of executedNodes) {
      const { payload, result } = node;
      const status = result!.exitCode === 0 ? "success" : "error";
      
      // Escapamos las comillas dobles para que el XML sea válido
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