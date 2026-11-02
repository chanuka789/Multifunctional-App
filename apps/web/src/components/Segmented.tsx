export function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="field" role="radiogroup" aria-label={props.label}>
      <span className="field-label">{props.label}</span>
      <div className="seg">
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === props.value}
            title={o.hint}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </div>
  );
}
