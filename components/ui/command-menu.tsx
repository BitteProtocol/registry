"use client"

import * as React from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

export interface CommandMenuItem {
  icon?: React.ReactNode
  label: string
  action: () => void
  metadata?: string
}

export interface CommandMenuGroup {
  heading?: string
  items: CommandMenuItem[]
}

interface CommandMenuProps {
  groups: CommandMenuGroup[]
  placeholder?: string
  emptyMessage?: string
}

export function CommandMenu({
  groups,
  placeholder = "Type a command or search...",
  emptyMessage = "No results found.",
}: CommandMenuProps) {
  const [open, setOpen] = React.useState(false)

  // Handle CMD+K keyboard shortcut
  useHotkeys("cmd+k", (e) => {
    e.preventDefault()
    setOpen((open) => !open)
  })

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl dark">
        <DialogTitle className="sr-only">Command Menu</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 bg-zinc-900">
          <div className="flex items-center border-b border-zinc-800 px-3">
            <div className="flex-1">
              <CommandInput placeholder={placeholder} className="placeholder:text-zinc-400" />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto flex h-full items-center pr-2 text-zinc-400 hover:text-zinc-50"
            >
            </button>
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto overflow-x-hidden">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groups.map((group, index) => (
              <CommandGroup key={index} heading={group.heading} className="text-zinc-400">
                {group.items.map((item, itemIndex) => (
                  <CommandItem
                    key={itemIndex}
                    onSelect={() => runCommand(item.action)}
                    className="flex items-center justify-between text-zinc-200 aria-selected:bg-zinc-800 cursor-pointer hover:cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </div>
                    {item.metadata && <span className="text-xs text-zinc-400">{item.metadata}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
