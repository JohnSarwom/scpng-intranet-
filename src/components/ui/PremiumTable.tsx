import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * PremiumTable Component - Standardized High-End UI for SCPNG Intranet
 */

const PremiumTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }
>(({ className, containerClassName, ...props }, ref) => (
  <div className={cn("overflow-auto border dark:border-white/5 rounded-xl text-sm relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm", containerClassName)}>
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm select-none border-collapse", className)}
      {...props}
    />
  </div>
))
PremiumTable.displayName = "PremiumTable"

const PremiumTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("sticky top-0 z-50 bg-gray-50/95 dark:bg-black/40 backdrop-blur-md border-b-2 border-gray-200 dark:border-white/10", className)} {...props} />
))
PremiumTableHeader.displayName = "PremiumTableHeader"

const PremiumTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0 px-1", className)}
    {...props}
  />
))
PremiumTableBody.displayName = "PremiumTableBody"

const PremiumTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-all duration-300 ease-out border-b border-gray-200 dark:border-white/10",
      "hover:bg-intranet-primary/[0.04] dark:hover:bg-white/5 group",
      className
    )}
    {...props}
  />
))
PremiumTableRow.displayName = "PremiumTableRow"

const PremiumTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { sticky?: 'left' | 'right' }
>(({ className, sticky, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-6 first:pl-8 last:pr-8 text-left align-middle font-semibold dark:text-gray-300 transition-colors hover:bg-gray-100/80 dark:hover:bg-white/5",
      sticky === 'left' && "sticky z-50 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md border-r border-b-2 border-gray-200 dark:border-white/10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]",
      sticky === 'left' && !className?.includes('left-') && "left-0",
      sticky === 'right' && "sticky z-50 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md border-l border-b-2 border-gray-200 dark:border-white/10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]",
      sticky === 'right' && !className?.includes('right-') && "right-0",
      className
    )}
    {...props}
  />
))
PremiumTableHead.displayName = "PremiumTableHead"

const PremiumTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { sticky?: 'left' | 'right', glass?: boolean }
>(({ className, sticky, glass, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-6 py-4 first:pl-8 last:pr-8 align-middle transition-colors border-b border-gray-200 dark:border-white/10",
      sticky === 'left' && "sticky z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-r border-gray-200 dark:border-white/10 group-hover:bg-intranet-primary/[0.02] dark:group-hover:bg-white/5 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]",
      sticky === 'left' && !className?.includes('left-') && "left-0",
      sticky === 'right' && "sticky z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-l border-gray-200 dark:border-white/10 group-hover:bg-intranet-primary/[0.02] dark:group-hover:bg-white/5 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]",
      sticky === 'right' && !className?.includes('right-') && "right-0",
      glass && "backdrop-blur-sm bg-white/5",
      className
    )}
    {...props}
  />
))
PremiumTableCell.displayName = "PremiumTableCell"

export {
  PremiumTable,
  PremiumTableHeader,
  PremiumTableBody,
  PremiumTableHead,
  PremiumTableRow,
  PremiumTableCell,
}
