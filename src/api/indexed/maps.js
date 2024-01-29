// @ts-check

import { letters } from '.';
import { isPromise, resolveHandleOrDID } from '..';
import { throttledAsyncCache } from '../throttled-async-cache';
import { toBase64, webcommit } from '../webcommit';

/**
 * @typedef {{ letter: string, a?: undefined } & {
 *  [shortDID: string]: {
 *    timestamp: number,
 *    prefixes: string[]
 *  }
 * }} LetterMap
 */

/**
 * @typedef { 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' |
 * 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' |
 * 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
 * } Letter
 */

/**
 * @typedef {{
 *  letter?: undefined,
 *  [shortDID: string]: string | undefined
 * }} CompactMap
 */

/**
 * @template [TMap=LetterMap]
 * @typedef {{
 *    loaded: string[],
 *    errors: string[],
 *    pending: string[],
 *    byLetter: { [letter: string]: LoadingLetterMapProgress<TMap> }
 *  }} Progress
 */

/**
 * @template [TMap=LetterMap]
 * @typedef {{letter: string, state: 'loaded', map: TMap} |
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
        case 'loaded': loaded.push(entry.letter); break;
        case 'error': errors.push(entry.letter); break;
      }
    }
    onprogress({ loaded, errors, pending, byLetter });
  }
}

/**
 * @param {(progress: Progress<CompactMap>) => void} [onprogress]
 * @returns {Promise<{ [letter: string]: CompactMap }>}
 */
export async function getCompactMaps(onprogress) {
  let completed = 0;
  /** @type {LoadingLetterMapProgress<CompactMap>[]} */
  const mapFetches = letters.split('').map(letter => ({ letter, state: 'loading', promise: loadLetterMap(letter) }));
  await Promise.all(mapFetches.map(f => f.state === 'loading' ? f.promise : undefined));

  /** @type {{ [letter: string]: CompactMap }} */
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
    const map = convertStoredMapToCompactMap(storedMap);
    return map;
  }

  function updateProgress() {
    if (completed === letters.length) return;
    if (typeof onprogress !== 'function') return;
    const loaded = [];
    const errors = [];
    const pending = [];
    /** @type {{ [letter: string]: LoadingLetterMapProgress<CompactMap> }} */
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
 * @param {string} shortDID
 * @param {string} firstLetter
 * @param {CompactMap} compactMap
 */
export function getPrefixes(shortDID, firstLetter, compactMap) {
  const entry = compactMap[shortDID];
  if (!entry) return;
  if (entry.length === 2) return [firstLetter + entry];
  const prefixes = [];
  for (let i = 0; i < entry.length; i += 2) {
    prefixes.push(firstLetter + entry.slice(i, i + 2));
  }
  return prefixes;
}

/**
 * @param {LetterMap} oldMap
 * @returns {CompactMap}
 */
export function convertOldLetterMapToCompactLetterMap(oldMap) {
  /** @type {CompactMap} */
  const compactMap = {};
  for (const shortDID in oldMap) {
    if (shortDID === 'letter') continue;
    const entry = oldMap[shortDID];
    compactMap[shortDID] = entry.prefixes.join(',');
  }
  return compactMap;
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

/**
 * @param {CompactMap | { [shortDID: string]: [timestamp: string, ...prefixes: string[]] }} storedMap
 * @returns {CompactMap}
 */
export function convertStoredMapToCompactMap(storedMap) {
  /** @type {CompactMap | undefined} */
  let compactMap;
  for (const shortDID in storedMap) {
    const val = storedMap[shortDID];
    if (typeof val === 'string') return /** @type {CompactMap} */(storedMap);
    if (!compactMap) compactMap = {};
    compactMap[shortDID] = val?.slice(1).join(',');
  }
  return /** @type {CompactMap} */(compactMap);
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

/**
 * @param {string} shortDID
 * @param {LetterMap[]} maps
 */
export async function reindexAccount(shortDID, maps) {
  const profile = await resolveHandleOrDID(shortDID);
  if (!profile) return;

  const prefixes = [];
  if (profile.shortHandle) getWordStartsLowerCase(profile.shortHandle, prefixes);
  if (profile.displayName) getWordStartsLowerCase(profile.displayName, prefixes);
  prefixes.sort();

  const bucketPrefixes = {};
  for (const pre of prefixes) {
    const letter = pre.charAt(0);
    const bucketPre = pre.slice(1);
    const list = bucketPrefixes[letter];
    if (list) list.push(bucketPre);
    else bucketPrefixes[letter] = [bucketPre];
  }

  let updatedBuckets
  for (const letter in bucketPrefixes) {
    const bucket = maps[letter];
    // if (!bucket) {
    //   maps[bucket] = bucket = /** @type {LetterMap} */({ letter });
    // }
  }

}

const wordStartRegExp = /[A-Z]*[a-z]*/g;
/** @param {string} str @param {string[]} wordStarts */
export function getWordStartsLowerCase(str, wordStarts = []) {
  if (!wordStarts) wordStarts = [];

  str.replace(wordStartRegExp, function (match) {
    const wordStart = match?.slice(0, 3).toLowerCase();
    if (wordStart?.length === 3 && wordStarts.indexOf(wordStart) < 0)
      wordStarts.push(wordStart);
    return match;
  });

  return wordStarts;
}