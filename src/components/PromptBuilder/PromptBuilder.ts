import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import type { AttachedFile } from "./types";

export class PromptBuilder {
  public message = signal("");
  public attachedFiles = signal<AttachedFile[]>([]);
  public searchResults = signal<string[]>([]);
  public showDropdown = signal(false);
  public searchQuery = signal("");
  private feedbackXml: string;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(feedbackXml: string) {
    this.feedbackXml = feedbackXml;
  }

  onMessageChange(text: string) {
    this.message.value = text;
    
    const cursorPos = text.lastIndexOf('@');
    if (cursorPos !== -1) {
      const afterAt = text.substring(cursorPos + 1);
      if (!afterAt.includes(' ') && afterAt.length > 0) {
        this.searchQuery.value = afterAt;
        this.debounceSearch(afterAt);
        return;
      }
    }
    
    this.showDropdown.value = false;
    this.searchResults.value = [];
  }

  private debounceSearch(query: string) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, 200);
  }

  private async performSearch(query: string) {
    try {
      const results = await invoke<string[]>("search_files", { query });
      this.searchResults.value = results;
      this.showDropdown.value = results.length > 0;
    } catch {
      this.searchResults.value = [];
      this.showDropdown.value = false;
    }
  }

  async attachFile(path: string) {
    if (this.attachedFiles.value.some(f => f.path === path)) return;

    try {
      const content = await invoke<string>("read_file_content", { path });
      this.attachedFiles.value = [...this.attachedFiles.value, { path, content }];
      
      const cursorPos = this.message.value.lastIndexOf('@' + this.searchQuery.value);
      if (cursorPos !== -1) {
        this.message.value = this.message.value.substring(0, cursorPos) + 
                            this.message.value.substring(cursorPos + 1 + this.searchQuery.value.length);
      }
      
      this.showDropdown.value = false;
      this.searchResults.value = [];
    } catch (e) {
      console.error("Error attaching file:", e);
    }
  }

  removeFile(path: string) {
    this.attachedFiles.value = this.attachedFiles.value.filter(f => f.path !== path);
  }

  buildPrompt(): string {
    let prompt = "";

    if (this.feedbackXml) {
      prompt += this.feedbackXml + "\n\n";
    }

    if (this.message.value.trim()) {
      prompt += this.message.value.trim() + "\n";
    }

    for (const file of this.attachedFiles.value) {
      prompt += `\n<attachment path="${file.path}">\n${file.content}\n</attachment>\n`;
    }

    return prompt;
  }

  async copyToClipboard(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(this.buildPrompt());
      return true;
    } catch {
      return false;
    }
  }
}
