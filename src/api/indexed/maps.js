// @ts-check

import { letters } from '.';
import { isPromise } from '..';
import { throttledAsyncCache } from '../throttled-async-cache';
import { toBase64, webcommit } from '../webcommit';

/**
 * @typedef {{ letter: string } & {
 *  [shortDID: string]: {
 *    timestamp: number,
 *    prefixes: string[]
 *  }
 * }} LetterMap
 */

/**
 * @typedef {{
 *    loaded: LetterMap[],
 *    errors: { letter: string, error: Error }[],
 *    pending: string[],
 *    byLetter: { [letter: string]: LoadingLetterMapProgress }
 *  }} Progress
 */

/**
 * @typedef {{letter: string, state: 'loaded', map: LetterMap} |
 * { letter: string, state: 'loading', promise: Promise } |
 * { letter: string, state: 'error', error: Error } |
 * { letter: string, state: 'missing' }
 * } LoadingLetterMapProgress
 */

const originTimestamp = 20231216;

/**
 * @param {(progress: Progress) => void} [onprogress]
 * @returns {Promise<{ [letter: string]: LetterMap }>}
 */
export async function getMaps(onprogress) {
  let completed = 0;
  /** @type {LoadingLetterMapProgress[]} */
  const mapFetches = letters.split('').map(letter => ({ letter, state: 'loading', promise: loadLetterMap(letter) }));
  await Promise.all(mapFetches.map(f => f.state === 'loading' ? f.promise : undefined));

  /** @type {{ [letter: string]: LetterMap }} */
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
        case 'loaded': loaded.push(entry.map); break;
        case 'error': errors.push(entry); break;
      }
    }
    onprogress({ loaded, errors, pending, byLetter });
  }
}

/**
 * @param {string} letter
 * @param {{ [shortDID: string]: [timestamp: string, ...prefixes: string[]] }} storedMap
 * @returns {LetterMap}
 */
export function convertStoredMapToLetterMap(letter, storedMap) {
  const letterMap = /** @type {LetterMap} */({ letter });
  for (const shortDID in storedMap) {
    const prefixes = storedMap[shortDID];
    const timestamp = Number(prefixes[0]);
    letterMap[shortDID] = { timestamp: timestamp, prefixes: prefixes.slice(1) };
  }
  return letterMap;
}

/** @param {LetterMap} letterMap */
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

/** @type {typeof fetch} */
const bucketFetch = throttledAsyncCache(fetch);

/** @param {string} letter @param {({pending, complete}) => void} [onprogress] */
export async function createOriginalMap(letter, onprogress) {
  if (letters.indexOf(letter) < 0) throw new Error(`Invalid letter: ${letter}`);

  const map = /** @type {LetterMap} */({ letter });

  /** @type {Promise[]} */
  const parallel = [];
  let pending = 0;
  let complete = 0;
  for (const secondLetter of letters) {
    for (const thirdLetter of letters) {
      pending++;
      parallel.push(createOriginalMapFor(secondLetter, thirdLetter));
    }
  }

  await Promise.all(parallel);

  return map;

  /** @param {string} secondLetter @param {string} thirdLetter */
  async function createOriginalMapFor(secondLetter, thirdLetter) {
    const url = `https://accounts.colds.ky/${letter}/${letter}${secondLetter}/${secondLetter}${thirdLetter}.json`;
    const response = await bucketFetch(url);
    if (response.status === 404) return;

    /** @type {{[shortDID: string]: (string | [handle: string, displayName: string]) }} */
    const list = await response.json();

    const prefix = secondLetter + thirdLetter;

    for (const shortDID in list) {
      let entry = map[shortDID];
      if (entry) entry.prefixes.push(prefix);
      else map[shortDID] = { timestamp: originTimestamp, prefixes: [prefix] };
    }
    complete++;

    if (typeof onprogress !== 'function') return;
    onprogress({ pending, complete });
  }
}

/** @param {LetterMap} map */
export function stringifyLetterMap(map) {
  const storedMap = convertLetterMapToStoredMap(map);
  const json =
    '{\n' +
    Object.keys(storedMap).map(shortDID =>
      JSON.stringify(shortDID) + ':' + JSON.stringify(storedMap[shortDID])).join(',\n') +
    '\n}\n';
  return json;
}

export async function storeNewMap({ letter, map, auth }) {
  if (letters.indexOf(letter) < 0) throw new Error(`Invalid letter: ${letter}`);

  const storedMap = stringifyLetterMap(map);
  const commit = await webcommit({
    owner: 'colds-ky-accounts',
    repo: letter,
    auth,
    branch: 'main'
  });
  await commit.put('map.json', storedMap);
  return await commit.commit('Original map');

  // const createOrUpdateRequest = fetch(
  //   `https://api.github.com/repos/colds-ky-accounts/${letter}/contents/map.json`,
  //   {
  //     method: 'PUT',
  //     headers: {
  //       Authorization: `token ${auth}`,
  //       Accept: "application/vnd.github.v3+json"
  //     },
  //     body: JSON.stringify({
  //       message: 'Original map',
  //       content: toBase64(storedMap)
  //     })
  //   });

  // await createOrUpdateRequest;
}