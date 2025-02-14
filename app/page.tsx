"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tool, Agent } from "@/lib/types";
import { PlusCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function Home() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const router = useRouter();

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

  const handleCreateAgent = async () => {
    if (selectedItems.size === 0) {
      alert("Please select at least one tool");
      return;
    }

    if (!instructions.trim()) {
      alert("Please provide instructions for your agent");
      return;
    }

    setIsCreating(true);

    try {
      const selectedTools = Array.from(selectedItems).map(
        (index) => tools[index]
      );

      const newAgent: Partial<Agent> = {
        name: `Agent ${Date.now()}`,
        accountId: "default-account",
        description: "Custom agent created from tools",
        instructions: instructions,
        tools: selectedTools,
        image: selectedTools[0]?.image || "bitte-symbol-black.svg",
        verified: false,
        repo: "custom-agent",
        generatedDescription: `Agent created with ${selectedTools.length} tools`,
      };

      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newAgent),
      });

      if (!response.ok) {
        throw new Error("Failed to create agent");
      }

      const createdAgent = await response.json();
      console.log(createdAgent);
      // Redirect to Bitte.ai registry with the agent ID
      window.location.href = `https://www.bitte.ai/registry/{createdAgent.id}`;
    } catch (error) {
      console.error("Error creating agent:", error);
      alert("Failed to create agent. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Top scrollable section */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10 py-2">
            <h1 className="text-2xl font-medium tracking-tight">
              Available tools
            </h1>
            <Button variant="link" className="text-white hover:text-white/80">
              View all
            </Button>
          </div>

          {/* Tools Grid */}
          <div className="pb-4">
            {loading ? (
              <div className="text-center text-zinc-500">Loading tools...</div>
            ) : (
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
                        <span className="text-zinc-500">{tool.type}</span>
                        <span className="text-zinc-700">•</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Agent Section - Fixed height */}
      <div className="bg-black border-t border-zinc-800 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <h2 className="text-2xl font-medium tracking-tight">
            Create an agent
          </h2>
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

      {/* Loading Overlay */}
      {isCreating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-8">
            <motion.div
              className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 relative"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 90, 180, 270, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500"
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
            <div className="space-y-2 text-center">
              <h3 className="text-xl font-medium text-white">
                Creating your agent
              </h3>
              <p className="text-zinc-400">
                Assembling tools and configuring capabilities...
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
