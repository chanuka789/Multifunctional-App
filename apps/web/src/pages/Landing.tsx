import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import * as RS from '@radix-ui/react-slider';
import * as RSw from '@radix-ui/react-switch';
import { ArrowRight } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/Site';
import { TOOLS, searchTools } from '@/tools/registry';
import { toolHref } from '@/components/CommandBar';
import { useReveal } from '@/hooks/useReveal';

/* ---------- Hero: the sentence is the layout, and its controls work ---------- */

function LiveWave({ speed, clean }: { speed: number; clean: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ speed, clean });
  state.current = { speed, clean };
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (now: number) => {
      const dpr = devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      t += ((now - last) / 1000) * state.current.speed;
      last = now;
      const bars = Math.max(18, Math.floor(w / 7));
      const bw = (w / bars) * 0.55;
      const noise = 1 - state.current.clean;
      for (let i = 0; i < bars; i++) {
        const x = i / bars;
        const p = x * 9 + t * 2.4;
        // a spoken phrase: syllables under a slow envelope, with gaps between words
        const env = Math.max(0, Math.sin(p * 0.7) * 0.5 + 0.5) ** 1.6;
        const syll = Math.abs(Math.sin(p * 3.1) * Math.sin(p * 1.3 + 1));
        const hiss = (Math.sin(i * 12.9898 + Math.floor(t * 18) * 78.233) * 43758.5453) % 1;
        const v = Math.min(1, env * syll * 0.95 + noise * (0.18 + Math.abs(hiss) * 0.22));
        const bh = Math.max(2, v * (h - 6));
        g.fillStyle = '#1f2b4d';
        g.beginPath();
        g.roundRect(i * (w / bars) + (w / bars - bw) / 2, (h - bh) / 2, bw, bh, bw / 2);
        g.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="slot-canvas" aria-hidden="true" />;
}

function Hero() {
  const [speed, setSpeed] = useState(1.25);
  const [clean, setClean] = useState(0.9);
  const [upload, setUpload] = useState(false);
  const [said, setSaid] = useState(false);
  // Speed squeezes the letters (narrower = faster); cleaner sound sets a heavier, clearer weight.
  const stretch = Math.round(100 - ((speed - 0.75) / (2 - 0.75)) * 38);
  const weight = Math.round(450 + clean * 450);
  return (
    <section className="hero field-dark" aria-labelledby="hero-title">
      <SiteHeader dark />
      <div className="hero-stage">
        <div className="chip chip-a" data-ui>
          <span className="chip-label">Speed</span>
          <output className="chip-value">{speed.toFixed(2)}×</output>
          <RS.Root className="slider chip-slider" min={0.75} max={2} step={0.05} value={[speed]} onValueChange={(v) => setSpeed(Math.round(v[0] * 100) / 100)} aria-label="Speed">
            <RS.Track className="slider-track">
              <RS.Range className="slider-range" />
            </RS.Track>
            <RS.Thumb className="slider-thumb" aria-label="Speed" />
          </RS.Root>
        </div>
        <h1 id="hero-title" className="hero-title" style={{ fontStretch: `${stretch}%`, fontWeight: weight }}>
          <span className="line-mask">
            <span>Studio tools</span>
          </span>
          <span className="line-mask hero-line-2">
            <span className="hero-l2">
              <span className="w-on">On</span>
              <span className="slot" role="img" aria-label="A voice recording, playing">
                <LiveWave speed={speed} clean={clean} />
              </span>
              <span className="br-sm" aria-hidden="true" />
              <span className="w-device">your device</span>
            </span>
          </span>
        </h1>
        <div className="chip chip-b" data-ui>
          <span className="chip-label">Noise removed</span>
          <output className="chip-value">{Math.round(clean * 100)}%</output>
          <RS.Root className="slider chip-slider" min={0} max={1} step={0.05} value={[clean]} onValueChange={(v) => setClean(v[0])} aria-label="Noise removed">
            <RS.Track className="slider-track">
              <RS.Range className="slider-range" />
            </RS.Track>
            <RS.Thumb className="slider-thumb" aria-label="Noise removed" />
          </RS.Root>
        </div>
        <div className={said ? 'chip chip-c chip-said' : 'chip chip-c'} data-ui>
          <label htmlFor="hero-upload" className="chip-label">
            Send files to a server
          </label>
          <RSw.Root
            id="hero-upload"
            className="switch"
            checked={upload}
            onCheckedChange={() => {
              setUpload(true);
              setSaid(true);
              setTimeout(() => setUpload(false), 420);
            }}
          >
            <RSw.Thumb className="switch-thumb" />
          </RSw.Root>
          <output className="chip-note" aria-live="polite">
            {said ? 'Nothing to send. It all runs here.' : 'Off'}
          </output>
        </div>
        <p className="hero-sub">
          Remove noise, change speed, turn speech into text and scans into Word files with the layout kept. Everything runs in your browser, on your own processor.
        </p>
      </div>
    </section>
  );
}

/* ---------- Showcase: the headline is an input ---------- */

const EXAMPLES = ['remove fan noise from my podcast', 'sinhala letter to word', 'join three voice notes'];

function Showcase() {
  const [q, setQ] = useState('make my lecture 1.3x faster');
  const results = useMemo(() => searchTools(q).slice(0, 3), [q]);
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="sec showcase reveal" aria-labelledby="ask-title">
      <h2 id="ask-title" className="sr-only">
        Say what you need
      </h2>
      <label htmlFor="ask" className="showcase-label">
        Say what you need
      </label>
      <div className="ask-line" data-ui>
        <input id="ask" className="ask" value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} autoComplete="off" />
      </div>
      <ul className="answers" data-ui aria-live="polite" aria-label="Matching tools">
        {results.length === 0 && <li className="answer muted">No match yet. Try “noise”, “speed”, “pdf” or “subtitles”.</li>}
        {results.map((r) => (
          <li key={r.tool.slug}>
            <Link className="answer" to={toolHref(r.tool.slug, r.value)}>
              <span className="answer-name">{r.tool.name}</span>
              <span className="answer-value">{r.value ?? r.tool.accepts}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="examples" role="group" aria-label="Examples">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="example" onClick={() => setQ(e)}>
            {e}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- How it works: the progress bar is the diagram ---------- */

const STAGES = [
  { secs: 1, dur: 'A second', text: 'First you drop the file. It opens in this tab, not on a server.', tone: 'stage-a' },
  { secs: 3, dur: 'A few seconds, once', text: 'Then the engine downloads one time and stays cached.', tone: 'stage-b' },
  { secs: 22, dur: 'About twenty seconds', text: 'Next your own processor cleans ten minutes of speech.', tone: 'stage-c' },
  { secs: 1, dur: 'Instant', text: 'Last, you save the result. No queue, no waiting list.', tone: 'stage-d' },
];

function HowItWorks() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="sec how reveal" aria-labelledby="how-title">
      <h2 id="how-title" className="head">
        Your laptop does the work
      </h2>
      <div className="bar" data-ui>
        {STAGES.map((s) => (
          <div key={s.dur} className={`stage ${s.tone}`} style={{ flexGrow: s.secs }}>
            <span className="stage-dur">{s.dur}</span>
          </div>
        ))}
      </div>
      <ol className="stage-notes">
        {STAGES.map((s) => (
          <li key={s.dur} style={{ flexGrow: s.secs }}>
            {s.text}
          </li>
        ))}
      </ol>
      <ol className="stages-phone" data-ui>
        {STAGES.map((s) => (
          <li key={s.dur} className={`stage ${s.tone}`} style={{ minHeight: Math.max(88, s.secs * 14) }}>
            <span className="grid gap-1">
              <span className="stage-dur">{s.dur}</span>
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="how-foot small muted">Timings are typical for a recent laptop and a ten-minute voice note. Older devices take longer; nothing is ever sent away to speed it up.</p>
    </section>
  );
}

/* ---------- List: every tool ---------- */

function OcrFragment() {
  return (
    <figure className="frag" data-ui aria-label="A scanned letter beside the Word document Ondevo rebuilt from it">
      <div className="frag-scan">
        <p className="frag-h">ශ්‍රී ලංකා තැපැල්</p>
        <p>Colombo 07</p>
        <p className="frag-gap">Dear Ms. Perera,</p>
        <p>Your parcel is ready to collect at the counter from Monday.</p>
        <table>
          <tbody>
            <tr>
              <td>Ref</td>
              <td>LK-2041</td>
            </tr>
            <tr>
              <td>Weight</td>
              <td>1.2 kg</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="frag-doc">
        <p className="frag-h">ශ්‍රී ලංකා තැපැල්</p>
        <p>Colombo 07</p>
        <p className="frag-gap">
          Dear <mark>Ms.</mark> Perera,
        </p>
        <p>Your parcel is ready to collect at the counter from Monday.</p>
        <table>
          <tbody>
            <tr>
              <td>Ref</td>
              <td>LK-2041</td>
            </tr>
            <tr>
              <td>Weight</td>
              <td>1.2 kg</td>
            </tr>
          </tbody>
        </table>
      </div>
      <figcaption className="small muted">Scan on the left, rebuilt DOCX on the right. One word is marked to check.</figcaption>
    </figure>
  );
}

function ToolList() {
  const ref = useReveal<HTMLElement>();
  const audio = TOOLS.filter((t) => t.group === 'audio');
  const docs = TOOLS.filter((t) => t.group === 'document');
  return (
    <section ref={ref} className="sec list reveal" aria-labelledby="list-title">
      <h2 id="list-title" className="list-title">
        Nineteen tools, <br className="hide-sm" />
        none of them upload
      </h2>
      <div className="list-grid">
        <div className="list-picture">
          <OcrFragment />
        </div>
        <div className="list-table">
          {[
            ['Audio', audio],
            ['Documents', docs],
          ].map(([label, rows]) => (
            <div key={label as string} className="list-group">
              <h3 className="list-kind">{label as string}</h3>
              <ul>
                {(rows as typeof TOOLS).map((t) => (
                  <li key={t.slug}>
                    <Link to={`/tools/${t.slug}`} className="list-row">
                      <span className="list-name">{t.name}</span>
                      <span className="list-acc">{t.accepts}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

const FAQ: [string, string][] = [
  [
    'Are my files uploaded anywhere?',
    'No. Each tool opens your file inside this browser tab and does the work with your own processor. A file only leaves your device if you press “Get a share link”, and that copy is deleted for good after 2 hours.',
  ],
  [
    'Why does a tool download something the first time?',
    'The engines (the noise model, the converter, OCR language data, the speech model) come from public open-source mirrors the first time you use them. Your browser keeps them, so the next run starts at once and works offline.',
  ],
  [
    'Does the OCR really keep the layout?',
    'The searchable PDF looks exactly like your original, because it keeps the page picture and lays the text invisibly on top. The Word file is rebuilt: headings, columns, tables, lists, bold, colour and pictures are placed where they were. Unusual fonts or handwriting may need small fixes, and uncertain words are marked so you can check them before you save.',
  ],
  [
    'Which languages work?',
    'Document OCR reads more than 100 languages, including Sinhala, Tamil and English, and mixed pages such as English with Sinhala. Speech to text understands about 90 spoken languages; for Sinhala and Tamil choose the Accurate model.',
  ],
  [
    'Do I need an account?',
    'No. Every tool works without one. An account keeps a list of your share links with their countdowns, and remembers your settings.',
  ],
  [
    'What device do I need?',
    'Any recent Chrome, Edge, Firefox or Safari on a laptop or desktop. Phones and tablets work too, best with shorter files. Speech to text runs faster on computers with a modern graphics chip.',
  ],
];

function Faq() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="sec faq reveal" aria-labelledby="faq-title">
      <h2 id="faq-title" className="faq-title">
        Plain answers
      </h2>
      <div className="faq-list">
        {FAQ.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>
              <span>{q}</span>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M4 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="close" aria-labelledby="close-title">
      <h2 id="close-title" className="close-title">
        Nothing leaves
        <br />
        this device
      </h2>
      <div className="close-foot">
        <p className="close-sub">Open a tool, drop a file and keep working. No sign-up, no upload, no queue.</p>
        <Link to="/tools" className="btn btn-accent btn-lg">
          Open the tools
        </Link>
      </div>
    </section>
  );
}

export default function Landing() {
  useEffect(() => {
    document.title = 'Ondevo — audio and document tools that run on your device';
  }, []);
  return (
    <>
      <Hero />
      <main id="main" tabIndex={-1}>
        <Showcase />
        <HowItWorks />
        <ToolList />
        <Faq />
        <Close />
      </main>
      <SiteFooter />
    </>
  );
}
