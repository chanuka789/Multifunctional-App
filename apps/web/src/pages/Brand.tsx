import { SitePage } from '@/components/Site';
import { Mark } from '@/components/Logo';

const COLORS = [
  { name: 'Ink navy', hex: '#1F2B4D', use: 'Text, the mark, main data', fg: '#fff' },
  { name: 'White', hex: '#FFFFFF', use: 'The ground', fg: '#1F2B4D' },
  { name: 'Tangerine', hex: '#F7941D', use: 'The one action, once per screen', fg: '#1F2B4D' },
  { name: 'Night', hex: '#05070A', use: 'Opening field, dark mode ground', fg: '#fff' },
  { name: 'Warm grey', hex: '#E3E1DC', use: 'Closing field, the slot', fg: '#1F2B4D' },
  { name: 'Frame', hex: '#F3F5F8', use: 'App frame around the sheet', fg: '#1F2B4D' },
];

export default function Brand() {
  return (
    <SitePage title="Brand">
      <article className="page">
        <h1 className="page-title">The Ondevo brand</h1>
        <aside className="page-aside grid gap-6 content-start">
          <p className="lead m-0">Ondevo means “on device”. The mark is a device tile where sound turns into text: two waveform bars, one tangerine, then three lines of type.</p>
          <div className="flex items-center gap-6">
            <Mark size={96} />
            <Mark size={48} />
            <Mark size={24} />
          </div>
        </aside>
        <div className="page-body grid gap-10">
          <section>
            <h2>Voice</h2>
            <p>Plain, calm and exact. Say what a tool does in the words people use (“remove the hiss”, not “AI-powered audio restoration”). Never promise what we cannot show; say clearly when something downloads, how big it is and how long a result is kept.</p>
          </section>
          <section>
            <h2>Colour</h2>
            <div className="swatches">
              {COLORS.map((c) => (
                <div key={c.hex} className="swatch" style={{ background: c.hex, color: c.fg, outline: c.hex === '#FFFFFF' ? '1px solid #e6e8ec' : undefined }}>
                  <strong>{c.name}</strong>
                  <span>{c.hex}</span>
                  <span>{c.use}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2>Type</h2>
            <p>One family, Archivo, used two ways.</p>
            <p className="m-0" style={{ fontWeight: 800, fontStretch: '62%', textTransform: 'uppercase', fontSize: 72, lineHeight: 0.9 }}>
              Display 800, width 62%
            </p>
            <p className="m-0 mt-3" style={{ fontSize: 19 }}>
              Text 400 at normal width, 16–19 px, line height 1.5. Buttons and labels at 600.
            </p>
          </section>
          <section>
            <h2>Rules we keep</h2>
            <ul>
              <li>Headlines stay within two lines at every width.</li>
              <li>One accent, on the main action only.</li>
              <li>No gradients, glows, glass panels or shadows on things at rest.</li>
              <li>Buttons are fully round; touch targets are at least 44 px.</li>
              <li>Motion uses transform and opacity, and stops when the device asks for reduced motion.</li>
            </ul>
          </section>
        </div>
      </article>
    </SitePage>
  );
}
