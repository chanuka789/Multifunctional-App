import * as RS from '@radix-ui/react-slider';

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = `s-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <div className="flex items-baseline justify-between gap-4">
        <span className="field-label" id={id}>
          {props.label}
        </span>
        <output className="readout" aria-live="polite">
          {props.format ? props.format(props.value) : props.value}
        </output>
      </div>
      <RS.Root
        className="slider"
        value={[props.value]}
        min={props.min}
        max={props.max}
        step={props.step}
        disabled={props.disabled}
        onValueChange={(v) => props.onChange(v[0])}
        aria-labelledby={id}
      >
        <RS.Track className="slider-track">
          <RS.Range className="slider-range" />
        </RS.Track>
        <RS.Thumb className="slider-thumb" aria-labelledby={id} aria-describedby={props.hint ? `${id}-h` : undefined} />
      </RS.Root>
      {props.hint && (
        <span className="field-hint" id={`${id}-h`}>
          {props.hint}
        </span>
      )}
    </div>
  );
}
