// @ts-check

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
