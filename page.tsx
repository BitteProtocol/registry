"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PlusCircle } from "lucide-react"
import { useState } from "react"

export default function Dashboard() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())

  const toggleSelection = (index: number) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-grow overflow-hidden">
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-medium tracking-tight">Available tools</h1>
            <Button variant="link" className="text-white hover:text-white/80">
              View all
            </Button>
          </div>

          {/* Tools Grid */}
          <div className="overflow-y-auto pr-4 pb-8" style={{ maxHeight: "calc(100vh - 300px)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {tools.map((tool, index) => (
                <button
                  key={index}
                  onClick={() => toggleSelection(index)}
                  className={`flex gap-6 text-left transition-opacity group ${
                    selectedItems.size > 0 && !selectedItems.has(index) ? "opacity-40" : ""
                  }`}
                >
                  <div className="w-28 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-zinc-800 to-zinc-900 relative">
                    <div className="w-full h-full bg-gradient-to-br from-zinc-700/50 to-zinc-800/50" />
                    {selectedItems.has(index) && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 pt-1">
                    <h2 className="font-medium text-lg leading-tight tracking-tight mb-2 group-hover:text-white/80">
                      {tool.title}
                    </h2>
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{tool.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500">{tool.type}</span>
                      <span className="text-zinc-700">•</span>
                      <span className="text-zinc-500">{tool.lastUpdated}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Agent Section */}
      <div className="bg-black border-t border-zinc-800 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <h2 className="text-2xl font-medium tracking-tight">Create an agent</h2>
          <div className="flex flex-col gap-4">
            <Textarea
              className="min-h-[120px] bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-400 resize-none text-lg"
              placeholder="How should your agent use these tools? Describe the tasks and objectives you want your agent to accomplish..."
            />
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <PlusCircle className="w-5 h-5" />
              Create Agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

