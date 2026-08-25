import { CATEGORY_PALETTE } from "../../lib/queries/categories";
import { Label } from "../ui/label";

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Cor</Label>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Cor ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={`size-7 rounded-full transition-transform ${
              value === color
                ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                : "hover:scale-110"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
