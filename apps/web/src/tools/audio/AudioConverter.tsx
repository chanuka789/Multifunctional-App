import { AudioTool } from './shared';

/** Decoding + the shared format picker already do the work; nothing else to change. */
export default function AudioConverter() {
  return (
    <AudioTool
      slug="audio-converter"
      suffix="converted"
      actionLabel="Convert"
      deps={[]}
      options={<p className="m-0 muted">Pick the format and quality below. For voice, 96 kbps MP3 or Opus is small and clear.</p>}
      process={async (pcm) => ({ pcm })}
    />
  );
}
