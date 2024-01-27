// @ts-check

import { letters } from '.';

/**
 * @typedef {{
 *  [shortDID: string]: {
 *    timestamp: number,
 *    prefixes: string[]
 *  }
 * }} LetterMap
 */

const originTimestamp = new Date('2023-12-16T07:03:00.000Z').getTime();

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
      const map = maps[i];
      if (!map) continue;
      letterMap[letters[i]] = map;
    }
    return letterMap;
  });
}

/** @param {string} letter */
export async function createMap(letter) {
  if (letters.indexOf(letter) < 0) throw new Error(`Invalid letter: ${letter}`);

  /** @type {LetterMap} */
  const map = {};

  /** @type {Promise[]} */
  const parallel = [];
  for (const secondLetter of letters) {
    for (const thirdLetter of letters) {
      parallel.push(updateMapFor(secondLetter, thirdLetter));
    }
  }

  await Promise.all(parallel);

  return map;

  /** @param {string} secondLetter @param {string} thirdLetter */
  async function updateMapFor(secondLetter, thirdLetter) {
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