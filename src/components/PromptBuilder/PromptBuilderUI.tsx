
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
    <div className="border-t border-gray-700 bg-gray-800 flex flex-col">
      <div
        className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-300">Compositor de Prompts</h3>
          <span className="text-gray-400 text-xs transform transition-transform">
            {isExpanded ? '▼' : '▲'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          disabled={!builder.message.value.trim() && builder.attachedFiles.value.length === 0}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            copied
              ? "bg-green-600 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-700 disabled:text-gray-500"
          }`}
        >
          {copied ? "¡Copiado!" : "Generar y Copiar"}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 pt-0">
          {builder.attachedFiles.value.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {builder.attachedFiles.value.map((file) => (
                <div key={file.path} className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                  <span className="max-w-[150px] truncate">{file.path}</span>
                  <button
                    onClick={() => builder.removeFile(file.path)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-gray-200 font-mono text-sm resize-none focus:outline-none focus:border-blue-500 min-h-[180px]"
              placeholder="Escribe tu mensaje aquí. Usa @ para adjuntar archivos del proyecto..."
              value={builder.message.value}
              onInput={(e) => builder.onMessageChange((e.target as HTMLTextAreaElement).value)}
            />
            <FileSearchDropdown builder={builder} />
          </div>
        </div>
      )}
    </div>
  );
}
