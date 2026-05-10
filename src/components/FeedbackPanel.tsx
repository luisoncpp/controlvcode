import { useStore } from '../context/StoreContext';

export function FeedbackPanel() {
  const store = useStore();
  const promptText = store.feedbackPrompt.value;
  const isAutoCopy = store.autoCopy.value;

  if (!promptText) return null;

  const handleCopy = async () => {
    const success = await store.copyFeedbackToClipboard();
    if (success) {
      const btn = document.getElementById('copy-btn') as HTMLButtonElement;
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '¡Copiado!';
        btn.className = 'px-3 py-1 rounded text-sm font-bold transition-colors bg-green-600 text-white';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.className = 'px-3 py-1 rounded text-sm font-bold transition-colors bg-gray-600 hover:bg-gray-500 text-gray-200';
        }, 2000);
      }
    }
  };

  return (
    <div className="mt-6 border border-gray-700 rounded bg-gray-800">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">
          Respuesta para el LLM
          {isAutoCopy && <span className="ml-2 text-xs text-blue-400">(autocopiando)</span>}
        </h3>
        <button 
          id="copy-btn"
          onClick={handleCopy}
          disabled={isAutoCopy}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            isAutoCopy 
              ? 'bg-blue-600 text-white opacity-70 cursor-not-allowed' 
              : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
          }`}
        >
          Copiar XML
        </button>
      </div>
      <pre className="p-4 text-xs text-gray-400 font-mono whitespace-pre-wrap break-words">
        {promptText}
      </pre>
    </div>
  );
}
