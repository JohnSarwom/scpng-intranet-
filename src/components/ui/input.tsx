import * as React from "react"

import { cn } from "@/lib/utils"
import { AiImproveButton, type AiAssistConfig } from "@/components/ai/AiImproveButton"

export interface InputProps extends React.ComponentProps<"input"> {
  /**
   * Show an "Improve with AI" button inside the field.
   * Pass the mode(s) and the setter for the field's value.
   */
  aiAssist?: AiAssistConfig
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, aiAssist, ...props }, ref) => {
    const input = (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          aiAssist && "pr-10",
          className
        )}
        ref={ref}
        {...props}
      />
    )

    if (!aiAssist) return input;

    const { wrapperClassName, ...assist } = aiAssist;
    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {input}
        <AiImproveButton
          floating
          value={typeof props.value === "string" ? props.value : String(props.value ?? "")}
          disabled={props.disabled || props.readOnly}
          {...assist}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
