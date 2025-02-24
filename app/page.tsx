"use client";

import { Tool } from "@/lib/types";
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import {
  CommandMenu,
  type CommandMenuGroup,
} from "@/components/ui/command-menu";
import { ToolGrid } from "../components/ToolGrid";
import { PromptInput } from "../components/PromptInput";
import { AgentSetupDialog } from "../components/AgentSetupDialog";
import { LoadingOverlay } from "../components/LoadingOverlay";

export default function Home() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  const groups: CommandMenuGroup[] = [
    {
      items: [
        {
          icon: <Plus className="h-4 w-4" />,
          label: "Add Tool",
          action: () => console.log("Add Tool clicked"),
        },
      ],
    },
    {
      heading: "Tools",
      items: tools.map((tool, index) => ({
        icon: (
          <img
            src={tool?.image || "bitte-symbol-black.svg"}
            alt={tool?.function?.name}
            className="h-4 w-4"
          />
        ),
        label: tool.function.name,
        action: () => toggleSelection(index),
        metadata: tool.isPrimitive ? "Primitive" : "Tool",
      })),
    },
  ];

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch("/api/tools");
        const data = await response.json();
        setTools(data);
      } catch (error) {
        console.error("Failed to fetch tools:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  const toggleSelection = (index: number) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleCreateAgent = () => {
    if (selectedItems.size === 0) {
      alert("Please select at least one tool");
      return;
    }

    if (!instructions.trim()) {
      alert("Please provide instructions for your agent");
      return;
    }

    setIsDialogOpen(true);
  };

  const handleAgentCreated = (agentId: string) => {
    window.location.href = `https://www.bitte.ai/agents/${agentId}`;
  };

  const handleAgentError = (error: Error) => {
    setIsCreatingAgent(false);
    console.error("Error creating agent:", error);
    alert("Failed to create agent. Please try again.");
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isCreatingAgent) {
      setIsDialogOpen(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <CommandMenu groups={groups} />
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10 py-2 gap-y-2">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-medium tracking-tight">
                Available tools
              </h1>
            </div>
            <p className="text-sm sm:text-base text-zinc-400 hidden sm:block">
              Press{" "}
              <kbd className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                ⌘
              </kbd>{" "}
              +{" "}
              <kbd className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                K
              </kbd>{" "}
              to open the command menu
            </p>
          </div>

          <div className="pb-4">
            <ToolGrid
              tools={tools}
              selectedItems={selectedItems}
              toggleSelection={toggleSelection}
              loading={loading}
            />
          </div>
        </div>
      </div>

      <PromptInput
        instructions={instructions}
        setInstructions={setInstructions}
        handleCreateAgent={handleCreateAgent}
        isCreating={isDialogOpen}
      />

      <AgentSetupDialog
        isOpen={isDialogOpen}
        onOpenChange={handleDialogClose}
        selectedTools={Array.from(selectedItems).map((index) => tools[index])}
        instructions={instructions}
        onSuccess={handleAgentCreated}
        onError={handleAgentError}
        setIsCreatingAgent={setIsCreatingAgent}
      />

      {isCreatingAgent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <LoadingOverlay />
          <div className="text-center mt-4">
            <h3 className="text-xl font-medium text-white">
              Creating your agent
            </h3>
            <p className="text-zinc-400">
              Assembling tools and configuring capabilities...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
