
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
        btn.className = 'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-[#238636] text-white';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.className = 'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d]';
        }, 2000);
      }
    }
  };

  return (
    <div className="mt-6 bg-[#161b22] border border-[#30363d] rounded-lg">
      <div className="flex justify-between items-center p-4 border-b border-[#30363d]">
        <h3 className="text-sm font-medium text-[#e6edf3]">
          Respuesta para el LLM
          {isAutoCopy && <span className="ml-2 text-xs text-[#2f81f7]">(autocopiando)</span>}
        </h3>
        <button 
          id="copy-btn"
          onClick={handleCopy}
          disabled={isAutoCopy}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
            isAutoCopy 
              ? 'bg-[#2f81f7] text-white opacity-60 cursor-not-allowed' 
              : 'bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d]'
          }`}
        >
          Copiar XML
        </button>
      </div>
      <pre className="p-4 text-xs text-[#7d8590] font-mono whitespace-pre-wrap break-words">
        {promptText}
      </pre>
    </div>
  );
}
