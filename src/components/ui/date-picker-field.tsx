import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  /** ISO date string (yyyy-MM-dd) — controlled mode */
  value?: string;
  onChange?: (v: string) => void;
  /** Uncontrolled mode + form submission via FormData */
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function DatePickerField({
  value,
  onChange,
  name,
  defaultValue = "",
  placeholder = "Selecione a data",
  disabled,
  className,
}: Props) {
  const [inner, setInner] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const current = value !== undefined ? value : inner;
  const date = current ? new Date(current + "T12:00:00") : undefined;

  const handle = (d?: Date) => {
    const iso = d ? format(d, "yyyy-MM-dd") : "";
    if (value === undefined) setInner(iso);
    onChange?.(iso);
    setOpen(false);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground", className)}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handle}
            initialFocus
            locale={ptBR}
            captionLayout="dropdown-buttons"
            fromYear={1940}
            toYear={new Date().getFullYear() + 5}
            defaultMonth={date}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
