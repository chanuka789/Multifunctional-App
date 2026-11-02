/** Tesseract language codes (tessdata 4.0 "best_int"). Data is fetched on demand from jsDelivr. */
export const PINNED = [
  { code: 'eng', name: 'English' },
  { code: 'sin', name: 'Sinhala' },
  { code: 'tam', name: 'Tamil' },
];

export const MORE: { code: string; name: string }[] = [
  ['afr', 'Afrikaans'], ['amh', 'Amharic'], ['ara', 'Arabic'], ['asm', 'Assamese'], ['aze', 'Azerbaijani'], ['bel', 'Belarusian'],
  ['ben', 'Bengali'], ['bod', 'Tibetan'], ['bos', 'Bosnian'], ['bre', 'Breton'], ['bul', 'Bulgarian'], ['cat', 'Catalan'],
  ['ceb', 'Cebuano'], ['ces', 'Czech'], ['chi_sim', 'Chinese (Simplified)'], ['chi_tra', 'Chinese (Traditional)'], ['chr', 'Cherokee'],
  ['cym', 'Welsh'], ['dan', 'Danish'], ['deu', 'German'], ['div', 'Dhivehi'], ['dzo', 'Dzongkha'], ['ell', 'Greek'], ['enm', 'English (Middle)'],
  ['epo', 'Esperanto'], ['est', 'Estonian'], ['eus', 'Basque'], ['fao', 'Faroese'], ['fas', 'Persian'], ['fil', 'Filipino'], ['fin', 'Finnish'],
  ['fra', 'French'], ['fry', 'Frisian'], ['gla', 'Scottish Gaelic'], ['gle', 'Irish'], ['glg', 'Galician'], ['guj', 'Gujarati'], ['hat', 'Haitian Creole'],
  ['heb', 'Hebrew'], ['hin', 'Hindi'], ['hrv', 'Croatian'], ['hun', 'Hungarian'], ['hye', 'Armenian'], ['iku', 'Inuktitut'], ['ind', 'Indonesian'],
  ['isl', 'Icelandic'], ['ita', 'Italian'], ['jav', 'Javanese'], ['jpn', 'Japanese'], ['kan', 'Kannada'], ['kat', 'Georgian'], ['kaz', 'Kazakh'],
  ['khm', 'Khmer'], ['kir', 'Kyrgyz'], ['kor', 'Korean'], ['lao', 'Lao'], ['lat', 'Latin'], ['lav', 'Latvian'], ['lit', 'Lithuanian'], ['ltz', 'Luxembourgish'],
  ['mal', 'Malayalam'], ['mar', 'Marathi'], ['mkd', 'Macedonian'], ['mlt', 'Maltese'], ['mon', 'Mongolian'], ['mri', 'Maori'], ['msa', 'Malay'],
  ['mya', 'Burmese'], ['nep', 'Nepali'], ['nld', 'Dutch'], ['nor', 'Norwegian'], ['oci', 'Occitan'], ['ori', 'Odia'], ['pan', 'Punjabi'], ['pol', 'Polish'],
  ['por', 'Portuguese'], ['pus', 'Pashto'], ['que', 'Quechua'], ['ron', 'Romanian'], ['rus', 'Russian'], ['san', 'Sanskrit'], ['slk', 'Slovak'],
  ['slv', 'Slovenian'], ['snd', 'Sindhi'], ['spa', 'Spanish'], ['sqi', 'Albanian'], ['srp', 'Serbian'], ['srp_latn', 'Serbian (Latin)'], ['sun', 'Sundanese'],
  ['swa', 'Swahili'], ['swe', 'Swedish'], ['syr', 'Syriac'], ['tat', 'Tatar'], ['tel', 'Telugu'], ['tgk', 'Tajik'], ['tha', 'Thai'], ['tir', 'Tigrinya'],
  ['ton', 'Tongan'], ['tur', 'Turkish'], ['uig', 'Uyghur'], ['ukr', 'Ukrainian'], ['urd', 'Urdu'], ['uzb', 'Uzbek'], ['vie', 'Vietnamese'], ['yid', 'Yiddish'], ['yor', 'Yoruba'],
].map(([code, name]) => ({ code, name }));

export const ALL_LANGS = [...PINNED, ...MORE];
export const langName = (code: string) => ALL_LANGS.find((l) => l.code === code)?.name ?? code;
export const fromWord = (w: string) => ALL_LANGS.find((l) => l.name.toLowerCase() === w.toLowerCase())?.code;
