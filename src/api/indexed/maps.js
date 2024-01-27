// @ts-check

import { letters } from '.';
import { toBase64, webcommit } from '../webcommit';

/**
 * @typedef {{
 *  [shortDID: string]: {
 *    timestamp: number,
 *    prefixes: string[]
 *  }
 * }} LetterMap
 */

const originTimestamp = 20231216;

/**
 * @returns {Promise<{ [letter: string]: LetterMap }>}
 */
export function getMaps() {
  const mapFetches = letters.split('').map(letter => fetch(`../${letter}/map.json`).then(re => 
    re.status === 404 ? undefined : re.json()));

  return Promise.all(mapFetches).then(maps => {
    /** @type {{ [letter: string]: LetterMap }} */
    const letterMap = {};
    for (let i = 0; i < maps.length; i++) {
      const map = convertStoredMapToLetterMap(maps[i]);
      if (!map) continue;
      letterMap[letters[i]] = map;
    }
    return letterMap;
  });
}

/**
 * @param {{ [shortDID: string]: [timestamp: string, ...prefixes: string[]] }} storedMap
 * @returns {LetterMap}
 */
export function convertStoredMapToLetterMap(storedMap) {
  /** @type {LetterMap} */
  const letterMap = {};
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
    const entry = letterMap[shortDID];
    const prefixes = [entry.timestamp.toString(), ...entry.prefixes];
    storedMap[shortDID] = /** @type {[string, ...string[]]} */(prefixes);
  }
  return storedMap;
}

/** @param {string} letter */
export async function createOriginalMap(letter) {
  if (letters.indexOf(letter) < 0) throw new Error(`Invalid letter: ${letter}`);

  /** @type {LetterMap} */
  const map = {};

  /** @type {Promise[]} */
  const parallel = [];
  for (const secondLetter of letters) {
    for (const thirdLetter of letters) {
      parallel.push(createOriginalMapFor(secondLetter, thirdLetter));
    }
  }

  await Promise.all(parallel);

  return map;

  /** @param {string} secondLetter @param {string} thirdLetter */
  async function createOriginalMapFor(secondLetter, thirdLetter) {
    const url = `${letter}/${letter}${secondLetter}/${secondLetter}${thirdLetter}.json`;
    const response = await fetch(url);
    if (response.status === 404) return;

    /** @type {{[shortDID: string]: (string | [handle: string, displayName: string]) }} */
    const list = await response.json();

    const prefix = secondLetter + thirdLetter;

    for (const shortDID in list) {
      let entry = map[shortDID];
      if (entry) entry.prefixes.push(prefix);
      else map[shortDID] = { timestamp: originTimestamp, prefixes: [prefix] };
    }
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
  // const commit = await webcommit({
  //   owner: 'colds-ky-accounts',
  //   repo: letter,
  //   auth,
  //   branch: 'main'
  // });

  const createOrUpdateRequest = fetch(
    `https://api.github.com/repos/colds-ky-accounts/${letter}/contents/map.json`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${auth}`,
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: 'Original map',
        content: toBase64(storedMap)
      })
    });

  await createOrUpdateRequest;
}