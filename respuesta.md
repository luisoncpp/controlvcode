<file path="src-tauri/src/lib.rs">
use std::process::Command;
use std::path::{PathBuf, Path};
use std::fs;
use std::fmt::Write;
use serde::Serialize;

fn project_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(Path::new(".")).to_path_buf()
}

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
        .current_dir(project_root())
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
    let file_path = project_root().join(&path);
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

fn build_tree(dir: &Path, prefix: &str, output: &mut String) -> std::io::Result<()> {
    if dir.is_dir() {
        let mut entries: Vec<_> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok())
            .collect();
        entries.sort_by_key(|e| e.file_name());
        let count = entries.len();
        for (i, entry) in entries.iter().enumerate() {
            let is_last = i == count - 1;
            let connector = if is_last { "└── " } else { "├── " };
            let child_prefix = if is_last { "    " } else { "│   " };
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                let _ = writeln!(output, "{}{}{}/", prefix, connector, name);
                build_tree(&path, &format!("{}{}", prefix, child_prefix), output)?;
            } else {
                let _ = writeln!(output, "{}{}{}", prefix, connector, name);
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn list_directory(path: String) -> Result<ExecutionResult, String> {
    let dir_path = project_root().join(&path);
    if !dir_path.exists() {
        return Err(format!("La ruta '{}' no existe.", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("'{}' no es un directorio.", path));
    }
    let mut output = String::new();
    let root_name = dir_path.file_name().unwrap_or_default().to_string_lossy();
    writeln!(&mut output, "{}/", root_name).map_err(|e| e.to_string())?;
    build_tree(&dir_path, "", &mut output).map_err(|e| e.to_string())?;
    Ok(ExecutionResult {
        stdout: output,
        stderr: String::new(),
        exit_code: 0,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_bash_command, write_file, list_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
</file>

<file path="src/types.ts">
export type ActionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';
export type ActionType = 'cmd' | 'file' | 'tree';

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

    // Detectar file path="...".../file
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

    // Detectar <tree path="..." /> o <tree path="..."></tree>
    const treeRegex = /<tree\s+path="([^"]+)"\s*\/?>\s*(?:<\/tree>)?/g;
    while ((match = treeRegex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'tree',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }

    return nodes;
  }
}
</file>

<file path="src/store/ExecutionStore.ts">
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
</file>