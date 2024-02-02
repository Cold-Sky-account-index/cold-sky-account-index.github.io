// @ts-check

import { letters } from '.';

/**
 * @typedef {{ letter: string, a?: undefined } & {
 *  [shortDID: string]: {
 *    timestamp: number,
 *    prefixes: string[]
 *  }
 * }} OldLetterMap
 */

/**
 * @typedef {{
 *    loaded: string[],
 *    errors: string[],
 *    pending: string[],
 *    byLetter: { [letter: string]: LoadingLetterMapProgress }
 *  }} Progress
 */

/**
 * @template [TMap=OldLetterMap]
 * @typedef {{letter: string, state: 'loaded', map: TMap} |
 * { letter: string, state: 'loading', promise: Promise } |
 * { letter: string, state: 'error', error: Error } |
 * { letter: string, state: 'missing' }
 * } LoadingLetterMapProgress
 */

const originTimestamp = 20231216;

/**
 * @param {(progress: Progress) => void} [onprogress]
 * @returns {Promise<{ [letter: string]: OldLetterMap }>}
 */
export async function getMaps(onprogress) {
  let completed = 0;
  /** @type {LoadingLetterMapProgress[]} */
  const mapFetches = letters.split('').map(letter => ({ letter, state: 'loading', promise: loadLetterMap(letter) }));
  await Promise.all(mapFetches.map(f => f.state === 'loading' ? f.promise : undefined));

  /** @type {{ [letter: string]: OldLetterMap }} */
  const letterMap = {};
  for (let i = 0; i < letters.length; i++) {
    const entry = mapFetches[i];
    if (entry.state !== 'loaded') continue;
    letterMap[letters[i]] = entry.map;
  }

  return letterMap;

  /** @param {string} letter */
  async function loadLetterMap(letter) {
    const letterIndex = letter.charCodeAt(0) - letters.charCodeAt(0);
    try {
      const result = await loadLetterMapCore(letter);
      mapFetches[letterIndex] = result ?
        { letter, state: 'loaded', map: result } :
        { letter, state: 'missing' };
    } catch (error) {
      mapFetches[letterIndex] = { letter, state: 'error', error };
    }

    completed++;
    updateProgress();
  }

  /** @param {string} letter */
  async function loadLetterMapCore(letter) {
    const url = `https://accounts.colds.ky/${letter}/map.json`;
    const re = await fetch(url);
    if (re.status === 404) return;
    const storedMap = await re.json();
    const map = convertStoredMapToLetterMap(letter, storedMap);
    return map;
  }

  function updateProgress() {
    if (completed === letters.length) return;
    if (typeof onprogress !== 'function') return;
    const loaded = [];
    const errors = [];
    const pending = [];
    /** @type {{ [letter: string]: LoadingLetterMapProgress }} */
    const byLetter = {};
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      const entry = mapFetches[i];
      byLetter[letter] = entry;
      switch (entry.state) {
        case 'loading': pending.push(letter); break;
        case 'loaded': loaded.push(entry.letter); break;
        case 'error': errors.push(entry.letter); break;
      }
    }
    onprogress({ loaded, errors, pending, byLetter });
  }
}

/**
 * @param {string} letter
 * @param {{ [shortDID: string]: [timestamp: string, ...prefixes: string[]] }} storedMap
 * @returns {OldLetterMap}
 */
export function convertStoredMapToLetterMap(letter, storedMap) {
  const letterMap = /** @type {OldLetterMap} */({ letter });
  for (const shortDID in storedMap) {
    const prefixes = storedMap[shortDID];
    const timestamp = Number(prefixes[0]);
    letterMap[shortDID] = { timestamp: timestamp, prefixes: prefixes.slice(1) };
  }
  return letterMap;
}

/** @param {OldLetterMap} letterMap */
export function convertLetterMapToStoredMap(letterMap) {
  /** @type {{ [shortDID: string]: [timestamp: string, ...prefixes: string[]] }} */
  const storedMap = {};
  for (const shortDID in letterMap) {
    if (shortDID === 'letter') continue;
    const entry = letterMap[shortDID];
    const prefixes = [entry.timestamp.toString(), ...entry.prefixes];
    storedMap[shortDID] = /** @type {[string, ...string[]]} */(prefixes);
  }
  return storedMap;
}

/** @param {OldLetterMap} map */
export function stringifyLetterMap(map) {
  const storedMap = convertLetterMapToStoredMap(map);
  const json =
    '{\n' +
    Object.keys(storedMap).map(shortDID =>
      JSON.stringify(shortDID) + ':' + JSON.stringify(storedMap[shortDID])).join(',\n') +
    '\n}\n';
  return json;
}
