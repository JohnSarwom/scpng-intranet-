import * as React from "react"
import { cn } from "@/lib/utils"
import { BaseCard, BaseCardProps } from "./BaseCard"

/**
 * PremiumKanbanBoard - Standardized horizontal scroll container for Kanban views
 */
const PremiumKanbanBoard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex gap-6 overflow-auto items-start pb-4 kanban-scrollbar flex-1",
      className
    )}
    {...props}
  />
))
PremiumKanbanBoard.displayName = "PremiumKanbanBoard"

/**
 * PremiumKanbanColumn - Standardized lane container with glassmorphic styling
 */
const PremiumKanbanColumn = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    title: string; 
    count?: number; 
    headerActions?: React.ReactNode;
    isOver?: boolean;
    isAtm?: boolean;
  }
>(({ className, title, count, headerActions, isOver, isAtm, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "w-80 flex-shrink-0 flex flex-col rounded-2xl transition-all duration-300 border",
      isAtm 
        ? "bg-white/70 dark:bg-black/60 border-gray-200 dark:border-white/20 shadow-md" 
        : "bg-gray-200/40 dark:bg-white/[0.07] border-gray-200/50 dark:border-white/10 shadow-sm",
      isOver && "bg-intranet-primary/[0.05] dark:bg-white/10 border-intranet-primary dark:border-intranet-primary/50 border-dashed ring-4 ring-intranet-primary/5 shadow-2xl scale-[1.01]",
      className
    )}
    {...props}
  >
    {/* Column Header */}
    <div className={cn(
      "p-4 font-semibold flex items-center justify-between rounded-t-2xl border-b",
      "bg-white/50 dark:bg-black/20 backdrop-blur-md border-gray-200 dark:border-white/10"
    )}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm tracking-tight text-gray-900 dark:text-gray-100 uppercase font-medium opacity-70">{title}</h3>
        {count !== undefined && (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-intranet-primary/10 text-intranet-primary dark:bg-intranet-primary/20 dark:text-intranet-primary rounded-full">
            {count}
          </span>
        )}
      </div>
      {headerActions && (
        <div className="flex items-center gap-1">
          {headerActions}
        </div>
      )}
    </div>

    {/* Column Content */}
    <div className="p-3 flex-grow space-y-3 min-h-[150px] relative">
      {children}
    </div>
  </div>
))
PremiumKanbanColumn.displayName = "PremiumKanbanColumn"

/**
 * PremiumKanbanCard - Standardized card with glassmorphism and maroon accents
 */
const PremiumKanbanCard = React.forwardRef<
  HTMLDivElement,
  BaseCardProps & { 
    isOverdue?: boolean; 
    isCompleted?: boolean;
    glow?: boolean;
    maroonAccent?: boolean;
  }
>(({ className, isOverdue, isCompleted, glow, maroonAccent = true, cardClassName, ...props }, ref) => (
  <BaseCard
    {...props}
    cardClassName={cn(
      "transition-all duration-300 group",
      "bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10",
      "backdrop-blur-md hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
      // Maroon hover glow
      glow && "hover:shadow-[0_0_20px_rgba(131,0,42,0.15)] dark:hover:shadow-[0_0_25px_rgba(131,0,42,0.25)]",
      // Overdue indicator
      isOverdue && "border-red-500/60 dark:border-red-600/60 ring-1 ring-red-500/20",
      maroonAccent && !isOverdue && "hover:border-intranet-primary/40",
      // Completed state
      isCompleted && "opacity-60 bg-gray-50/50 dark:bg-gray-900/50 grayscale-[0.2]",
      cardClassName
    )}
  />
))
PremiumKanbanCard.displayName = "PremiumKanbanCard"

export {
  PremiumKanbanBoard,
  PremiumKanbanColumn,
  PremiumKanbanCard
}
