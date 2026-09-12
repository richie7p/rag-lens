import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  value,
  min,
  max,
  step,
  onValueChange,
  label,
  display,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (n: number) => void;
  label: string;
  display: string;
  unit?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 sm:gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-2xs font-medium tracking-wide text-muted uppercase sm:text-xs">
          {label}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-fg sm:text-sm">
          {display}
          {unit ? <span className="ml-1 hidden text-subtle sm:inline">{unit}</span> : null}
        </span>
      </div>
      <SliderPrimitive.Root
        className="relative flex h-11 w-full touch-none items-center select-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onValueChange(v[0] ?? value)}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-2 hairline">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block size-4 rounded-full bg-fg shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          )}
          aria-label={label}
        />
      </SliderPrimitive.Root>
    </label>
  );
}
