"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tool, Agent } from "@/lib/types";
import { PlusCircle, Upload, Wand2, ImagePlus, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function Home() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentImage, setAgentImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAgentImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAgentImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setAgentImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

    setIsDialogOpen(true);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      alert("Please provide an image prompt");
      return;
    }

    setIsGeneratingImage(true);
    try {
      console.log('Generating image with instructions:', imagePrompt);
      const response = await fetch(`/api/generate-image?prompt=${encodeURIComponent(imagePrompt)}`);
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }
      const data = await response.json();
      console.log('Generated image data:', data);
      setAgentImage(data.url);
    } catch (error) {
      console.error("Failed to generate image:", error);
      alert('Failed to generate image. Please try uploading one instead.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmitAgent = async () => {
    if (!agentName.trim()) {
      alert("Please provide a name for your agent");
      return;
    }

    setIsCreating(true);
    setIsDialogOpen(false);

    try {
      const selectedTools = Array.from(selectedItems).map(
        (index) => tools[index]
      );

      const newAgent: Partial<Agent> = {
        name: agentName,
        accountId: "default-account",
        description: "Custom agent created from tools",
        instructions: instructions,
        tools: selectedTools,
        image: agentImage || selectedTools[0]?.image || "bitte-symbol-black.svg",
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
      window.location.href = `https://www.bitte.ai/registry/${createdAgent.id}`;
    } catch (error) {
      console.error("Error creating agent:", error);
      alert("Failed to create agent. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkip = async () => {
    setAgentName(`Agent ${Math.floor(Math.random() * 1000)}`);
    setAgentImage("/bitte-symbol-black.svg");
    handleSubmitAgent();
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
                        <span className="text-zinc-500">{tool.isPrimitive ? "Primitive" : "Tool"}</span>
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

      {/* Agent Creation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-[700px] h-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium text-white mb-2">Complete Agent Setup</DialogTitle>
          </DialogHeader>
          <div className="flex gap-8 h-full">
            <div className="w-[300px] h-[300px]">
              {!agentImage ? (
                <>
                  <div
                    onClick={handleThumbnailClick}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/50 transition-colors hover:bg-zinc-800",
                      isDragging && "border-blue-500/50 bg-blue-500/5",
                    )}
                  >
                    <div className="rounded-full bg-zinc-900 p-3 shadow-sm">
                      <ImagePlus className="h-6 w-6 text-zinc-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">Click to select</p>
                      <p className="text-xs text-zinc-400">
                        or drag and drop file here
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full">
                  <div className="group relative h-full overflow-hidden rounded-lg border border-zinc-700">
                    <Image
                      src={agentImage}
                      alt="Preview"
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="300px"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleThumbnailClick}
                        className="h-9 w-9 p-0"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleRemove}
                        className="h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Agent Name</label>
                <Input
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter agent name..."
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Agent Image</label>
                </div>

                <div className="flex gap-2">
                  <Input
                    className="bg-zinc-800 border-zinc-700 text-white flex-1"
                    placeholder="Enter image prompt..."
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className="text-zinc-300 hover:text-white text-sm flex items-center gap-2"
                  >
                    <Wand2 className={cn("h-4 w-4", isGeneratingImage && "animate-spin")} />
                    {isGeneratingImage ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-auto border-t border-zinc-800">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-zinc-500 hover:text-zinc-300 text-sm"
                >
                  Skip
                </Button>
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleSubmitAgent}
                    className="bg-white hover:bg-white/90 text-black text-sm px-4"
                  >
                    Create Agent
                  </Button>
                </div>
              </div>
            </div>

            <Input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        </DialogContent>
      </Dialog>

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
