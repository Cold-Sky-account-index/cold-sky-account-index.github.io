// @ts-check

import { azLetters } from '.';
import { retryFetch } from '../retryFetch';
import { webcommit } from '../webcommit';

/**
 * @typedef {{
 *    loaded: string[],
 *    errors: string[],
 *    pending: string[],
 *    byLetter: { [letter: string]: LoadingLetterMapProgress }
 *  }} Progress
 */

/**
 * @typedef {{letter: string, state: 'loaded', map: CompactMap} |
 * { letter: string, state: 'loading', promise: Promise } |
 * { letter: string, state: 'error', error: Error } |
 * { letter: string, state: 'missing' }
 * } LoadingLetterMapProgress
 */

/** @typedef {import('.').CompactMap} CompactMap */

/**
 * @param {(progress: Progress) => void} [onprogress]
 * @returns {Promise<{ [letter: string]: CompactMap }>}
 */
export async function getMaps(onprogress) {
  let completed = 0;
  /** @type {LoadingLetterMapProgress[]} */
  const mapFetches = azLetters.split('').map(letter => ({ letter, state: 'loading', promise: loadLetterMap(letter) }));
  await Promise.all(mapFetches.map(f => f.state === 'loading' ? f.promise : undefined));

  /** @type {{ [letter: string]: CompactMap }} */
  const letterMap = {};
  for (let i = 0; i < azLetters.length; i++) {
    const entry = mapFetches[i];
    if (entry.state !== 'loaded') continue;
    letterMap[azLetters[i]] = entry.map;
  }

  return letterMap;

  /** @param {string} letter */
  async function loadLetterMap(letter) {
    const letterIndex = letter.charCodeAt(0) - azLetters.charCodeAt(0);
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
    try {
      var re = await fetch(url);
    } catch (potentiallyCors) {
      re = await fetch('https://corsproxy.io/?' + url);
    }

    if (re.status === 404) return;
    const storedMap = await re.json();
    const map = convertStoredMapToCompactMap(storedMap);
    return map;
  }

  function updateProgress() {
    if (completed === azLetters.length) return;
    if (typeof onprogress !== 'function') return;
    const loaded = [];
    const errors = [];
    const pending = [];
    /** @type {{ [letter: string]: LoadingLetterMapProgress }} */
    const byLetter = {};
    for (let i = 0; i < azLetters.length; i++) {
      const letter = azLetters[i];
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
 * @typedef {{
 *  updated: {
 *    letter: import('.').AZLetter,
 *    map: CompactMap | undefined,
 *    errorRetry?: import('../retryFetch').RetryArgs | undefined
 * }[],
 * all: (CompactMap | undefined)[],
 * pending: number,
}} MapStreamingState
 */

/**
 * @returns {AsyncGenerator<MapStreamingState>}
 */
export async function* streamMaps() {
  let resolveNext = () => { };
  /** @type {Promise<void>} */
  let resolvePromise = new Promise(resolve => resolveNext = resolve);

  /** @type {(CompactMap | undefined)[]} */
  const letterMaps = [];
  /** @type {{ letter: import('.').AZLetter, map: CompactMap | undefined, errorRetry?: import('../retryFetch').RetryArgs }[]} */
  let newLetterMaps = [];

  let pending = 0;
  for (const azLetter of azLetters) {
    pending++;
    loadLetterMap(azLetter);
  }

  while (pending) {
    await resolvePromise;
    resolvePromise = new Promise(resolve => resolveNext = resolve);

    const report = { updated: newLetterMaps, all: letterMaps, pending };
    newLetterMaps = [];
    yield report;
  }

  /** @param {import('.').AZLetter} azLetter */
  async function loadLetterMap(azLetter) {
    const letterIndex = azLetter.charCodeAt(0) - azLetters.charCodeAt(0);
    const result = await loadLetterMapCore(azLetter, retryArgs => {
      let map = newLetterMaps.find(x => x.letter === azLetter);
      if (map) {
        map.errorRetry = retryArgs;
      } else {
        newLetterMaps.push({ letter: azLetter, map: undefined, errorRetry: retryArgs });
      }
      resolveNext();
    });

    letterMaps[letterIndex] = result;
    let map = newLetterMaps.find(x => x.letter === azLetter);
    if (map) {
      map.errorRetry = undefined;
      map.map = result;
    } else {
      newLetterMaps.push({ letter: azLetter, map: result });
    }

    pending--;
    resolveNext();
  }

  /**
   * @param {import('.').AZLetter} letter
   * @param {({}: import('../retryFetch').RetryArgs) => void} onretry
   */
  async function loadLetterMapCore(letter, onretry) {
    let url = `https://accounts.colds.ky/${letter}/map.json`;

    const re = await retryFetch(url, {onretry});

    if (re.status === 404) return;

    const storedMap = await re.json();
    const map = convertStoredMapToCompactMap(storedMap);
    return map;
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
 * @param {import('./old-letter-map').OldLetterMap} oldMap
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

export async function storeNewMap({ letter, map, auth }) {
  if (azLetters.indexOf(letter) < 0) throw new Error(`Invalid letter: ${letter}`);

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

/** @param {CompactMap} map */
export function stringifyLetterMap(map) {
  const json =
    '{\n' +
    Object.keys(map).map(shortDID =>
      JSON.stringify(shortDID) + ':' + JSON.stringify(map[shortDID])).join(',\n') +
    '\n}\n';
  return json;
}
