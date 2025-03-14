import { Button } from "@/components/ui/button";
import { PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { NotionLikeEditor } from "./NotionLikeEditor";
import { Tool } from "@/lib/types";

interface PromptInputProps {
  instructions: string;
  setInstructions: (value: string) => void;
  handleCreateAgent: () => void;
  isCreating: boolean;
  selectedTools: Tool[];
}

export function PromptInput({
  instructions,
  setInstructions,
  handleCreateAgent,
  isCreating,
  selectedTools,
}: PromptInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);

  const defaultTemplate = useMemo(() => {
    const toolsList = selectedTools.map(tool => `
<h3>${tool.function.name}</h3>
<p>[When and how to use this tool]</p>`).join('\n');

    return `<h1>Agent Instructions</h1>

<h2>🎯 Goal & Responsibilities</h2>
<ul>
<li>[What should this agent accomplish?]</li>
<li>[What are its main tasks?]</li>
</ul>

<h2>🛠️ Tools</h2>
${toolsList}

<h2>💬 Personality & Communication</h2>
<ul>
<li>[How should the agent interact and communicate?]</li>
<li>[What tone and style should it use?]</li>
</ul>

<h2>⚠️ Limitations</h2>
<ul>
<li>[What should the agent NOT do?]</li>
<li>[Any specific restrictions?]</li>
</ul>`;
  }, [selectedTools]);

  useEffect(() => {
    if (!hasEdited) {
      setInstructions(defaultTemplate);
    }
  }, [defaultTemplate, setInstructions, hasEdited]);

  const handleChange = (newContent: string) => {
    setHasEdited(true);
    setInstructions(newContent);
  };

  return (
    <div className="bg-black border-t border-zinc-800 px-4 py-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl sm:text-2xl font-medium tracking-tight">Enter Prompt</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span className="ml-2">Collapse</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span className="ml-2">Expand</span>
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:gap-4">
          <div 
            className="relative bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden"
          >
            <div
              className={`transition-all duration-500 ease-in-out transform ${
                isExpanded ? 'h-[calc(70vh-140px)]' : 'h-[150px] sm:h-[180px]'
              }`}
            >
              <div className="absolute inset-0 overflow-auto">
                <NotionLikeEditor
                  content={instructions}
                  onChange={handleChange}
                  onFocus={() => !isExpanded && setIsExpanded(true)}
                  placeholder="Click to start writing..."
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Button
              size="lg"
              className="gap-2"
              onClick={handleCreateAgent}
              disabled={isCreating}
            >
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              Create Agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 