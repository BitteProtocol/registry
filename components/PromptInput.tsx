import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";

interface PromptInputProps {
  instructions: string;
  setInstructions: (value: string) => void;
  handleCreateAgent: () => void;
  isCreating: boolean;
}

export function PromptInput({
  instructions,
  setInstructions,
  handleCreateAgent,
  isCreating,
}: PromptInputProps) {
  return (
    <div className="bg-black border-t border-zinc-800 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <h2 className="text-2xl font-medium tracking-tight">Enter Prompt</h2>
        <div className="flex flex-col gap-4">
          <Textarea
            className="min-h-[100px] bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-400 resize-none text-lg"
            placeholder="How should your agent use these tools? Describe the tasks and objectives you want your agent to accomplish..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <Button
            size="lg"
            className="gap-2 w-full sm:w-auto"
            onClick={handleCreateAgent}
            disabled={isCreating}
          >
            <PlusCircle className="w-5 h-5" />
            Create Agent
          </Button>
        </div>
      </div>
    </div>
  );
} 