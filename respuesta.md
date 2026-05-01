<file path="src/types.ts">
export type ActionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';
export type ActionType = 'cmd' | 'file';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ActionNode {
  id: string;
  type: ActionType;
  payload: string;
  content?: string; // Contenido para acciones 'file'
  status: ActionStatus;
  result: ExecutionResult | null;
}
</file>

<file path="src/store/LLMParser.ts">
import { ActionNode } from '../types';

export class LLMParser {
  static parse(rawText: string): ActionNode[] {
    const nodes: ActionNode[] = [];

    // Detectar <cmd>...</cmd>
    const cmdRegex = /<cmd>([\s\S]*?)<\/cmd>/g;
    let match;
    while ((match = cmdRegex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'cmd',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }

    // Detectar el tag file path="..." ... y su cierre
    const fileRegex = /<file\s+[^>]*path="([^"]+)"[^>]*>\s*([\s\S]*?)<\/file>/g;
    while ((match = fileRegex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'file',
        payload: match[1].trim(),
        content: match[2],
        status: 'pending',
        result: null
      });
    }

    return nodes;
  }
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
      let result: ExecutionResult;
      if (node.type === 'cmd') {
        result = await invoke('execute_bash_command', { command: node.payload });
      } else if (node.type === 'file') {
        result = await invoke('write_file', { path: node.payload, content: node.content ?? '' });
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

<file path="src-tauri/src/lib.rs">
use std::process::Command;
use std::path::PathBuf;
use std::fs;
use serde::Serialize;

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[tauri::command]
fn execute_bash_command(command: &str) -> Result<ExecutionResult, String> {
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

#[tauri::command]
fn write_file(path: String, content: String) -> Result<ExecutionResult, String> {
    let file_path = PathBuf::from(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    Ok(ExecutionResult {
        stdout: format!("Archivo '{}' escrito exitosamente.", path),
        stderr: String::new(),
        exit_code: 0,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_bash_command, write_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
</file>