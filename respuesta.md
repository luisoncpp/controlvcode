<file path="src-tauri/src/lib.rs">
use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    // Le indicamos a Rust que envíe esto como "exitCode" para que TypeScript lo entienda
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[tauri::command]
fn execute_bash_command(command: &str) -> Result<ExecutionResult, String> {
    // Truco: chcp 65001 >nul cambia la consola a UTF-8 silenciosamente antes de tu comando
    let full_command = format!("chcp 65001 >nul & {}", command);

    let output = Command::new("cmd")
        .arg("/C")
        .arg(&full_command)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_bash_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
</file>

<file path="src/store/ExecutionStore.ts">
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
</file>