import { useStore } from '../context/StoreContext';

export function PromptInput() {
  const store = useStore();

  return (
    <div className="flex flex-col h-full gap-2">
      <textarea
        className="flex-1 p-4 bg-gray-800 border border-gray-700 rounded text-gray-200 font-mono text-sm resize-none focus:outline-none focus:border-blue-500"
        placeholder="Pega aquí la respuesta del LLM con las etiquetas <cmd>..."
        value={store.rawInput.value}
        onInput={(e) => store.processInput((e.target as HTMLTextAreaElement).value)}
      />
    </div>
  );
}