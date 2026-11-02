import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type ToolGroup = 'audio' | 'document';

export interface ToolDef {
  slug: string;
  group: ToolGroup;
  name: string;
  /** One line on what it does, in plain words. */
  blurb: string;
  /** What the user hands it. */
  accepts: string;
  /** Words people type when they look for it (used by the command bar). */
  keywords: string[];
  /** Engine that does the work, shown on the tool page so users know what runs. */
  engine: string;
  /** First-time download size of the engine, if any. */
  download?: string;
  Component: LazyExoticComponent<ComponentType>;
}

export const TOOLS: ToolDef[] = [
  {
    slug: 'noise-remover',
    group: 'audio',
    name: 'Noise remover and voice enhancer',
    blurb: 'Take out hiss, hum, fans and traffic, then make the voice clear and even.',
    accepts: 'MP3, WAV, M4A, OGG, FLAC, or a video',
    keywords: ['noise', 'denoise', 'clean', 'hiss', 'hum', 'background', 'voice', 'enhance', 'podcast', 'clear', 'echo', 'fan'],
    engine: 'RNNoise neural network + studio voice chain',
    download: '1.5 MB',
    Component: lazy(() => import('./audio/NoiseRemover')),
  },
  {
    slug: 'speed',
    group: 'audio',
    name: 'Speed changer',
    blurb: 'Play audio faster or slower, from 0.5× to 3×, with the voice kept natural.',
    accepts: 'Any audio file or video',
    keywords: ['speed', 'faster', 'slower', 'tempo', '1.1', '1.2', '1.25', '1.3', '1.5', '2x', 'lecture', 'playback', 'x'],
    engine: 'SoundTouch time-stretch',
    Component: lazy(() => import('./audio/SpeedChanger')),
  },
  {
    slug: 'pitch',
    group: 'audio',
    name: 'Pitch shifter',
    blurb: 'Raise or lower the key up to 12 semitones without changing the speed.',
    accepts: 'Any audio file',
    keywords: ['pitch', 'key', 'semitone', 'transpose', 'deeper', 'higher', 'voice changer', 'karaoke'],
    engine: 'SoundTouch pitch-shift',
    Component: lazy(() => import('./audio/PitchShifter')),
  },
  {
    slug: 'trim',
    group: 'audio',
    name: 'Trim and fade',
    blurb: 'Cut the part you want on the waveform and add smooth fades.',
    accepts: 'Any audio file',
    keywords: ['trim', 'cut', 'crop', 'clip', 'fade', 'ringtone', 'shorten', 'split'],
    engine: 'Web Audio',
    Component: lazy(() => import('./audio/TrimFade')),
  },
  {
    slug: 'silence-remover',
    group: 'audio',
    name: 'Silence remover',
    blurb: 'Close the long pauses in lectures, voice notes and interviews.',
    accepts: 'Any audio file',
    keywords: ['silence', 'pause', 'gap', 'dead air', 'quiet', 'shorten', 'tighten'],
    engine: 'Web Audio',
    Component: lazy(() => import('./audio/SilenceRemover')),
  },
  {
    slug: 'loudness',
    group: 'audio',
    name: 'Loudness normaliser',
    blurb: 'Set the volume to the level YouTube, Spotify or podcasts expect.',
    accepts: 'Any audio file',
    keywords: ['volume', 'loud', 'louder', 'quiet', 'normalize', 'normalise', 'lufs', 'gain', 'boost', 'level'],
    engine: 'BS.1770 loudness meter',
    Component: lazy(() => import('./audio/Loudness')),
  },
  {
    slug: 'audio-converter',
    group: 'audio',
    name: 'Audio converter',
    blurb: 'Change format and size: MP3, WAV, M4A, OGG, Opus or FLAC.',
    accepts: 'Any audio file',
    keywords: ['convert', 'format', 'mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus', 'compress', 'bitrate', 'smaller'],
    engine: 'ffmpeg.wasm',
    download: '31 MB',
    Component: lazy(() => import('./audio/AudioConverter')),
  },
  {
    slug: 'extract-audio',
    group: 'audio',
    name: 'Extract audio from video',
    blurb: 'Save the sound of an MP4, MOV, MKV or WebM video as an audio file.',
    accepts: 'MP4, MOV, MKV, WebM, AVI',
    keywords: ['video', 'extract', 'mp4 to mp3', 'rip', 'soundtrack', 'mov', 'audio from video'],
    engine: 'ffmpeg.wasm',
    download: '31 MB',
    Component: lazy(() => import('./audio/ExtractAudio')),
  },
  {
    slug: 'audio-joiner',
    group: 'audio',
    name: 'Audio joiner',
    blurb: 'Put several clips together in order, with an optional crossfade.',
    accepts: 'Two or more audio files',
    keywords: ['join', 'merge', 'combine', 'concat', 'together', 'crossfade', 'playlist'],
    engine: 'Web Audio',
    Component: lazy(() => import('./audio/AudioJoiner')),
  },
  {
    slug: 'voice-recorder',
    group: 'audio',
    name: 'Voice recorder',
    blurb: 'Record from your microphone with live noise reduction.',
    accepts: 'Your microphone',
    keywords: ['record', 'microphone', 'mic', 'voice note', 'memo', 'dictaphone'],
    engine: 'MediaRecorder',
    Component: lazy(() => import('./audio/VoiceRecorder')),
  },
  {
    slug: 'speech-to-text',
    group: 'audio',
    name: 'Speech to text',
    blurb: 'Turn speech into text and subtitles (TXT, SRT, VTT) in 90+ languages.',
    accepts: 'Any audio file or video',
    keywords: ['transcribe', 'transcript', 'subtitles', 'captions', 'srt', 'vtt', 'speech', 'whisper', 'dictation', 'text'],
    engine: 'Whisper (OpenAI model, run locally)',
    download: '40–250 MB',
    Component: lazy(() => import('./audio/SpeechToText')),
  },
  {
    slug: 'ocr',
    group: 'document',
    name: 'Document OCR',
    blurb: 'Turn scans, photos and PDFs into text you can edit, with the layout kept.',
    accepts: 'JPG, PNG, WEBP, multi-page PDF',
    keywords: ['ocr', 'scan', 'text', 'recognize', 'image to text', 'pdf to word', 'docx', 'sinhala', 'tamil', 'extract text', 'searchable', 'photo to text'],
    engine: 'Tesseract 5 + layout rebuild',
    download: '2–15 MB per language',
    Component: lazy(() => import('./docs/Ocr')),
  },
  {
    slug: 'pdf-merge',
    group: 'document',
    name: 'Merge PDF',
    blurb: 'Combine several PDFs into one, in the order you choose.',
    accepts: 'Two or more PDFs',
    keywords: ['merge', 'combine', 'join', 'pdf', 'together'],
    engine: 'pdf-lib',
    Component: lazy(() => import('./docs/PdfMerge')),
  },
  {
    slug: 'pdf-split',
    group: 'document',
    name: 'Split PDF',
    blurb: 'Pull out pages or ranges like 1-3, 7 into new PDFs.',
    accepts: 'A PDF',
    keywords: ['split', 'extract pages', 'separate', 'pdf', 'range'],
    engine: 'pdf-lib',
    Component: lazy(() => import('./docs/PdfSplit')),
  },
  {
    slug: 'pdf-organize',
    group: 'document',
    name: 'Organise PDF pages',
    blurb: 'Rotate, reorder and delete pages, then save.',
    accepts: 'A PDF',
    keywords: ['rotate', 'reorder', 'delete pages', 'organize', 'organise', 'arrange', 'pdf'],
    engine: 'pdf-lib + pdf.js',
    Component: lazy(() => import('./docs/PdfOrganize')),
  },
  {
    slug: 'images-to-pdf',
    group: 'document',
    name: 'Images to PDF',
    blurb: 'Make one PDF from photos or scans, A4, Letter or fitted to each image.',
    accepts: 'JPG, PNG, WEBP',
    keywords: ['jpg to pdf', 'image to pdf', 'photos', 'scan to pdf', 'png to pdf'],
    engine: 'pdf-lib',
    Component: lazy(() => import('./docs/ImagesToPdf')),
  },
  {
    slug: 'pdf-to-images',
    group: 'document',
    name: 'PDF to images',
    blurb: 'Save every page as a sharp PNG or JPG.',
    accepts: 'A PDF',
    keywords: ['pdf to jpg', 'pdf to png', 'pdf to image', 'export pages', 'render'],
    engine: 'pdf.js',
    Component: lazy(() => import('./docs/PdfToImages')),
  },
  {
    slug: 'pdf-compress',
    group: 'document',
    name: 'Compress PDF',
    blurb: 'Make scanned PDFs much smaller by re-saving page images.',
    accepts: 'A PDF',
    keywords: ['compress', 'reduce', 'smaller', 'size', 'pdf', 'email'],
    engine: 'pdf.js + pdf-lib',
    Component: lazy(() => import('./docs/PdfCompress')),
  },
  {
    slug: 'image-tools',
    group: 'document',
    name: 'Image resize and convert',
    blurb: 'Resize, compress and convert images to JPG, PNG or WEBP.',
    accepts: 'JPG, PNG, WEBP, GIF, BMP',
    keywords: ['image', 'resize', 'compress', 'jpg', 'png', 'webp', 'photo', 'convert', 'smaller'],
    engine: 'Canvas',
    Component: lazy(() => import('./docs/ImageTools')),
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
export const GROUP_LABEL: Record<ToolGroup, string> = { audio: 'Audio', document: 'Documents and PDF' };

/** Very small natural-language matcher for the command bar ("make my lecture 1.3x faster"). */
export function searchTools(query: string): { tool: ToolDef; score: number; value?: string }[] {
  const q = query.toLowerCase().trim();
  if (!q) return TOOLS.slice(0, 5).map((tool) => ({ tool, score: 0 }));
  const words = q.split(/[^\p{L}\p{N}.]+/u).filter(Boolean);
  const speed = q.match(/(\d(?:\.\d{1,2})?)\s*(x|×|times)/);
  const semis = q.match(/([+-]?\d{1,2})\s*(semitones?|st)\b/);
  const lang = q.match(/\b(sinhala|tamil|english|hindi|french|german|spanish|arabic|chinese|japanese)\b/);
  return TOOLS.map((tool) => {
    let score = 0;
    const hay = [tool.name, tool.blurb, ...tool.keywords].join(' ').toLowerCase();
    for (const w of words) {
      if (tool.keywords.some((k) => k === w)) score += 3;
      else if (w.length > 2 && hay.includes(w)) score += 1;
    }
    let value: string | undefined;
    if (speed && tool.slug === 'speed') {
      score += 5;
      value = `${parseFloat(speed[1])}× speed`;
    }
    if (semis && tool.slug === 'pitch') {
      score += 5;
      value = `${semis[1]} semitones`;
    }
    if (lang && tool.slug === 'ocr') {
      score += 3;
      value = `${lang[1][0].toUpperCase()}${lang[1].slice(1)} text`;
    }
    return { tool, score, value };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
