import * as React from "react"

import { cn } from "@/lib/utils"
import { AiImproveButton, type AiAssistConfig } from "@/components/ai/AiImproveButton"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Show an "Improve with AI" button inside the field.
   * Pass the mode(s) and the setter for the field's value.
   */
  aiAssist?: AiAssistConfig
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, aiAssist, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);

    // Merge refs so both forwardRef and internalRef work
    const setRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [ref]
    );

    const adjustHeight = () => {
      if (internalRef.current) {
        internalRef.current.style.height = "auto";
        internalRef.current.style.height = `${internalRef.current.scrollHeight + 2}px`;
      }
    };

    React.useEffect(() => {
      adjustHeight();
    }, [props.value, props.defaultValue]);

    const textarea = (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden",
          aiAssist && "pr-10",
          className
        )}
        ref={setRef}
        onChange={(e) => {
          adjustHeight();
          if (onChange) {
            onChange(e);
          }
        }}
        {...props}
      />
    )

    if (!aiAssist) return textarea;

    const { wrapperClassName, ...assist } = aiAssist;
    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {textarea}
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
Textarea.displayName = "Textarea"

export { Textarea }
