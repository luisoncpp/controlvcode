import { useState } from 'preact/hooks';
import { useStore } from '../context/StoreContext';

export function FeedbackPanel() {
  const store = useStore();
  const [copied, setCopied] = useState(false);
  const promptText = store.feedbackPrompt.value;

  if (!promptText) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  return (
    <div className="mt-6 border border-gray-700 rounded bg-gray-800">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">Respuesta para el LLM</h3>
        <button 
          onClick={handleCopy}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            copied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
          }`}
        >
          {copied ? '¡Copiado!' : 'Copiar XML'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs text-gray-400 font-mono max-h-64 overflow-y-auto">
        {promptText}
      </pre>
    </div>
  );
}