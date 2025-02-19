import { Tool } from "@/lib/types";

interface ToolGridProps {
  tools: Tool[];
  selectedItems: Set<number>;
  toggleSelection: (index: number) => void;
  loading: boolean;
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-400" />
    </div>
  );
}

export function ToolGrid({ tools, selectedItems, toggleSelection, loading }: ToolGridProps) {
  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
      {tools.map((tool, index) => (
        <button
          key={index}
          onClick={() => toggleSelection(index)}
          className={`flex gap-4 text-left transition-opacity group hover:bg-zinc-900/50 p-3 rounded-md ${
            selectedItems.size > 0 && !selectedItems.has(index)
              ? "opacity-40"
              : ""
          }`}
        >
          <div className="w-24 h-24 rounded-md overflow-hidden flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 relative">
            <img
              src={tool?.image || "bitte-symbol-black.svg"}
              alt={tool?.function?.name}
              className="w-full h-full object-cover"
            />
            {selectedItems.has(index) && (
              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-blue-500" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="font-medium text-lg leading-tight tracking-tight mb-1 group-hover:text-white/80">
              {tool.function.name}
            </h2>
            <p className="text-sm text-zinc-400 line-clamp-2 mb-1">
              {tool.function.description}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">
                {tool.isPrimitive ? "Primitive" : "Tool"}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
} 