import { useStore } from '../context/StoreContext';
import { useRef } from 'preact/hooks';

export function PromptInput() {
  const store = useStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (textareaRef.current) {
        textareaRef.current.value = text;
        store.processInput(text);
      }
    } catch (err) {
      console.error('Error al leer el portapapeles:', err);
      alert('No se pudo acceder al portapapeles. Asegúrate de haber concedido el permiso.');
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex justify-end">
        <button
          onClick={handlePasteFromClipboard}
          title="Pegar contenido del portapapeles"
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded border border-gray-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Pegar
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="flex-1 p-4 bg-gray-800 border border-gray-700 rounded text-gray-200 font-mono text-sm resize-none focus:outline-none focus:border-blue-500"
        placeholder="Pega aquí la respuesta del LLM con las etiquetas <cmd>..."
        value={store.rawInput.value}
        onInput={(e) => store.processInput((e.target as HTMLTextAreaElement).value)}
      />
    </div>
  );
}
