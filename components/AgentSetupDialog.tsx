import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Upload, Trash2, Wand2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Tool, Agent } from "@/lib/types";

interface AgentSetupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTools: Tool[];
  instructions: string;
  onSuccess: (agentId: string) => void;
  onError: (error: Error) => void;
  setIsCreatingAgent: (isCreating: boolean) => void;
}

export function AgentSetupDialog({
  isOpen,
  onOpenChange,
  selectedTools,
  instructions,
  onSuccess,
  onError,
  setIsCreatingAgent,
}: AgentSetupDialogProps) {
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setImage(null);
      setImagePrompt("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);

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
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      alert("Please provide an image prompt");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const response = await fetch(
        `/api/generate-image?prompt=${encodeURIComponent(imagePrompt)}`
      );
      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      setImage(data.url);
    } catch (error) {
      console.error("Failed to generate image:", error);
      alert("Failed to generate image. Please try uploading one instead.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const createAgent = async (agentName: string) => {
    setIsCreatingAgent(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: agentName,
          accountId: "default-account",
          description: "Custom agent created from tools",
          instructions,
          tools: selectedTools,
          image: image || selectedTools[0]?.image || "bitte-symbol-black.svg",
          verified: false,
          repo: "custom-agent",
          generatedDescription: `Agent created with ${selectedTools.length} tools`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create agent");
      }

      const createdAgent = await response.json();
      onOpenChange(false);
      onSuccess(createdAgent.id);
    } catch (error) {
      setIsCreatingAgent(false);
      onError(error instanceof Error ? error : new Error("Failed to create agent"));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Please provide a name for your agent");
      return;
    }
    await createAgent(name.trim());
  };

  const handleSkip = async () => {
    const randomName = `Agent ${Math.floor(Math.random() * 1000)}`;
    await createAgent(randomName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-[700px] h-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium text-white mb-2">
            Complete Agent Setup
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-8 h-full">
          <div className="w-[300px] h-[300px]">
            {!image ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/50 transition-colors hover:bg-zinc-800",
                  isDragging && "border-blue-500/50 bg-blue-500/5"
                )}
              >
                <div className="rounded-full bg-zinc-900 p-3 shadow-sm">
                  <ImagePlus className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">
                    Click to select
                  </p>
                  <p className="text-xs text-zinc-400">
                    or drag and drop file here
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full">
                <div className="group relative h-full overflow-hidden rounded-lg border border-zinc-700">
                  <Image
                    src={image}
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
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 w-9 p-0"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setImage(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
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
              <label className="text-sm font-medium text-zinc-400">
                Agent Name
              </label>
              <Input
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter agent name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">
                  Agent Image
                </label>
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
                  className="text-zinc-300 text-sm flex items-center gap-2"
                >
                  <Wand2
                    className={cn(
                      "h-4 w-4",
                      isGeneratingImage && "animate-spin"
                    )}
                  />
                  {isGeneratingImage ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-auto border-t border-zinc-800">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-zinc-500 text-sm"
              >
                Skip
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSubmit}
                  className="bg-white text-black text-sm px-4 hover:bg-white"
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
  );
} 