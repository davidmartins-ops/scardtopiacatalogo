import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // CORREÇÃO 29: alinhado ao padrão do Input — borda visível, hover/focus consistentes.
        "box-border flex min-h-[80px] w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground ring-offset-background transition-all duration-200 placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
