import { addMonths, isSameMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../ui/button";
import { formatMonthLabel } from "../../lib/format";

type MonthNavProps = {
  month: Date;
  onChange: (month: Date) => void;
};

export function MonthNav({ month, onChange }: MonthNavProps) {
  const isCurrentMonth = isSameMonth(month, new Date());

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        aria-label="Mês anterior"
        onClick={() => onChange(subMonths(month, 1))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <span className="min-w-36 text-center text-sm font-medium">{formatMonthLabel(month)}</span>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        aria-label="Próximo mês"
        disabled={isCurrentMonth}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
