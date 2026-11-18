/** Panditji's language: 'en' (default) or 'hi'. Remembered in this browser only. */
export type Lang = 'en' | 'hi';
const KEY = 'hast-rekha-lang';

export function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* private mode: the choice lasts for this session only */
  }
}
