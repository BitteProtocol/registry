import { toast as sonnerToast } from "sonner"
import type { ReactNode } from "react"

export interface ToastData {
  title?: string
  description?: ReactNode
  variant?: "default" | "destructive"
  action?: {
    label: string
    onClick: () => void
  }
}

export function useToast() {
  function toast({ title, description, variant = "default", action, ...props }: ToastData) {
    sonnerToast[variant === "destructive" ? "error" : "message"](title, {
      description,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      ...props,
    })
  }

  return {
    toast,
  }
} 