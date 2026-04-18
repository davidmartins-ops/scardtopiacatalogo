import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SetOption {
  code: string;
  name: string;
}

interface Props {
  sets: SetOption[];
  value: string; // "all" or set code
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  triggerClassName?: string;
}

const SetCombobox = ({ sets, value, onChange, className, placeholder = "Todas as coleções", triggerClassName }: Props) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (value === "all") return placeholder;
    const found = sets.find((s) => s.code === value);
    return found ? `${found.name} (${found.code.toUpperCase()})` : placeholder;
  }, [value, sets, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 px-2.5 text-xs bg-muted/30 border-border/50 justify-between gap-1.5 font-normal max-w-[280px] min-w-[180px]",
            triggerClassName,
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{selectedLabel}</span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0 w-[280px] z-50 bg-popover", className)} align="start">
        <Command>
          <CommandInput placeholder="Buscar coleção..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma coleção encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onChange("all");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                Todas as coleções
              </CommandItem>
              {sets.map((s) => (
                <CommandItem
                  key={s.code}
                  value={`${s.name} ${s.code}`}
                  onSelect={() => {
                    onChange(s.code);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === s.code ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase">{s.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SetCombobox;
