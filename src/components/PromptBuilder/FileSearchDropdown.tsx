import { PromptBuilder } from "./PromptBuilder";

export function FileSearchDropdown({ builder }: { builder: PromptBuilder }) {
  if (!builder.showDropdown.value) return null;

  return (
    <div className="absolute bottom-full left-0 w-full bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto mb-1 z-50">
      {builder.searchResults.value.map((path) => (
        <div
          key={path}
          onClick={() => builder.attachFile(path)}
          className="px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="flex-shrink-0">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {path}
        </div>
      ))}
    </div>
  );
}
