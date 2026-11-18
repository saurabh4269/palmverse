/**
 * Past readings, on this device only (versioned localStorage). We store the
 * derived reading (element, chosen shapes, a few ratios) and the card image
 * (a drawing, never a photo). Nothing is uploaded. Every access is guarded:
 * private browsing can throw.
 */
import type { HandProfile, LineChoices } from '../content/types.js';

const KEY = 'hast-rekha/v1';
const MAX = 12;

export interface SavedReading {
  at: number; // ms
  profile: HandProfile;
  choices: LineChoices;
  /** small JPEG data URL of the share card */
  card?: string;
}

export interface SaveData {
  version: 1;
  readings: SavedReading[];
  mountsHeard: string[];
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as SaveData;
      if (d.version === 1 && Array.isArray(d.readings)) return d;
    }
  } catch {
    /* fall through */
  }
  return { version: 1, readings: [], mountsHeard: [] };
}

export function save(d: SaveData): void {
  try {
    d.readings = d.readings.slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // quota: drop card images and retry once
    try {
      d.readings = d.readings.map((r, i) => (i < d.readings.length - 2 ? { ...r, card: undefined } : r));
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* give up silently */
    }
  }
}

/** The most recent reading of the other hand, if any (for the left/right comparison). */
export function otherHand(d: SaveData, side: 'left' | 'right'): SavedReading | undefined {
  for (let i = d.readings.length - 1; i >= 0; i--) if (d.readings[i].profile.side !== side) return d.readings[i];
  return undefined;
}
