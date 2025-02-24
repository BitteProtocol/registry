import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Upload, Trash2, Wand2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Tool } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
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
      toast({
        title: "Error",
        description: "Please provide an image prompt",
        variant: "destructive",
      });
      return;
    }

    if (imagePrompt.length < 10) {
      toast({
        title: "Error",
        description: "Prompt must be at least 10 characters",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Failed to generate image. Please try uploading one instead.",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Please provide a name for your agent",
        variant: "destructive",
      });
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
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-[700px] h-[90vh] sm:h-[450px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium text-white mb-2">
            Complete Agent Setup
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 h-full overflow-y-auto">
          <div className="w-full sm:w-[300px] h-[200px] sm:h-[300px]">
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
                  <ImagePlus className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">
                    Click to select
                  </p>
                  <p className="text-xs text-zinc-400">
                    or drag and drop file here
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="h-full">
                <div className="group relative h-full overflow-hidden rounded-lg border border-zinc-700">
                  <Image
                    src={image}
                    alt="Preview"
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 300px"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                    >
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
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
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">
                Agent Name
              </label>
              <Input
                className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700"
                placeholder="Enter agent name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">
                  Agent Image
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700"
                  placeholder="Describe the agent's appearance..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="w-full sm:w-auto whitespace-nowrap"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {isGeneratingImage ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                onClick={handleSkip}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Skip
              </Button>
              <Button
                onClick={handleSubmit}
                variant="secondary"
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                Create Agent
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 