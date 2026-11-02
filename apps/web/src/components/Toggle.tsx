import * as RSw from '@radix-ui/react-switch';

export function Toggle(props: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `t-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="field-label block cursor-pointer">
          {props.label}
        </label>
        {props.description && <p className="field-hint m-0 mt-1">{props.description}</p>}
      </div>
      <RSw.Root id={id} className="switch mt-0.5" checked={props.checked} onCheckedChange={props.onChange}>
        <RSw.Thumb className="switch-thumb" />
      </RSw.Root>
    </div>
  );
}
