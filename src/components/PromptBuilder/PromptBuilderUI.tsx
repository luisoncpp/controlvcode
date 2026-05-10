
import { useState } from "preact/hooks";
import { PromptBuilder } from "./PromptBuilder";
import { FileSearchDropdown } from "./FileSearchDropdown";

export function PromptBuilderUI({ builder }: { builder: PromptBuilder }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = async () => {
    const success = await builder.copyToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-t border-[#30363d] bg-[#161b22] flex flex-col">
      <div
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-[#21262d] transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#e6edf3]">Compositor de Prompts</h3>
          <span className={`text-[#7d8590] text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            ▲
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          disabled={!builder.message.value.trim() && builder.attachedFiles.value.length === 0}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
            copied
              ? "bg-[#238636] text-white"
              : "bg-[#2f81f7] hover:bg-[#58a6ff] text-white disabled:bg-[#21262d] disabled:text-[#484f58]"
          }`}
        >
          {copied ? "¡Copiado!" : "Generar y Copiar"}
        </button>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 animate-fade-in-down">
            {builder.attachedFiles.value.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {builder.attachedFiles.value.map((file) => (
                  <div key={file.path} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#21262d] rounded-md text-xs text-[#c9d1d9] border border-[#30363d]">
                    <span className="max-w-[150px] truncate">{file.path}</span>
                    <button
                      onClick={() => builder.removeFile(file.path)}
                      className="text-[#7d8590] hover:text-[#f85149] transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <textarea
                className="w-full p-3 bg-[#0d1117] border border-[#30363d] rounded-md text-[#e6edf3] font-mono text-sm resize-none focus:outline-none focus:border-[#2f81f7] focus:ring-1 focus:ring-[#2f81f7] min-h-[140px] transition-colors duration-200"
                placeholder="Escribe tu mensaje aquí. Usa @ para adjuntar archivos del proyecto..."
                value={builder.message.value}
                onInput={(e) => builder.onMessageChange((e.target as HTMLTextAreaElement).value)}
              />
              <FileSearchDropdown builder={builder} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
