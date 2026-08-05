"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboboxOption = { value: string; label: string; hint?: string };

export function Combobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  createLabel = "Add",
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or type new…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {onCreate && query.trim() ? (
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    onCreate(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="size-4" /> {createLabel} &ldquo;{query.trim()}&rdquo;
                </button>
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No results.
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                  {option.hint && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
              {onCreate && query.trim() && !exactMatch && options.length > 0 && (
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={() => {
                    onCreate(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  {createLabel} &ldquo;{query.trim()}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
