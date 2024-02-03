// @ts-check

import { azLetters } from '.';
import { resolveHandleOrDID, shortenDID } from '..';
import { firehose } from '../firehose';

/** @typedef {import('.').AZLetter} Letter */

/**
 * @typedef {{
   *  letter: Letter,
   *  shortDID: string,
   *  value: string | [handle: string, displayName: string],
   *  prefixes: string
   * }} IndexUpdate
 */

/**
 * @param {{ [letter: string]: import('./maps').CompactMap }} maps
 */
export async function* runFirehoseAndUpdate(maps) {
  /** @type {IndexUpdate[]} */
  const allIndexUpdates = [];
  /** @type {Partial<Record<Letter, IndexUpdate[]>>}*/
  const allIndexUpdatesByLetter = {};

  const recentShortDIDs = {};

  for await (const block of firehose()) {
    if (!block?.length) continue;

    for (const entry of block) {
      if (!entry.messages?.length) continue;

      for (const msg of entry.messages) {
        if (msg.$type !== 'app.bsky.graph.follow') continue;
        if (!msg.repo) continue;

        const shortDID = shortenDID(msg.repo);
        if (!shortDID || recentShortDIDs[shortDID]) continue;
        recentShortDIDs[shortDID] = true;

        yield {
          shortDID,
          all: allIndexUpdates, allByLetter: allIndexUpdatesByLetter,
          accountUpdates: undefined
        };

        /** @type {AccountInfo} */
        let accountDetails;
        try {
          accountDetails = await resolveHandleOrDID(shortDID);
        } catch (resolveError) {
          console.error('Failed to resolve DID', shortDID, resolveError);
          continue;
        }

        const accountUpdates = indexAccountData(accountDetails);

        let anyChanges = false;

        for (const letter of azLetters) {
          const oldPrefixes = maps[letter][shortDID];
          if (!oldPrefixes) continue;
          const letterUpdate = accountUpdates.byLetter[letter];
          if (!letterUpdate) {
            const removeUpdate = {
              letter,
              shortDID,
              value: accountUpdates.list[0].value,
              prefixes: ''
            };
            allIndexUpdates.push(removeUpdate);

            const allByLetter = allIndexUpdatesByLetter[removeUpdate.letter] || (allIndexUpdatesByLetter[removeUpdate.letter] = []);
            allByLetter.push(removeUpdate);

            anyChanges = true;
          }
        }

        for (const update of accountUpdates.list) {
          const oldPrefixes = maps[update.letter][shortDID];
          if (oldPrefixes && oldPrefixes === update.prefixes) continue;

          allIndexUpdates.push(update);
          const allByLetter = allIndexUpdatesByLetter[update.letter] || (allIndexUpdatesByLetter[update.letter] = []);
          allByLetter.push(update);
          anyChanges = true;
        }

        if (!anyChanges) {
          console.log('No changes for ', shortDID, accountUpdates);
          continue;
        }

        yield {
          shortDID,
          all: allIndexUpdates, allByLetter: allIndexUpdatesByLetter,
          accountUpdates
        };
      }
    }
  }
}

/**
 * @param {AccountInfo} accountDetails
 */
function indexAccountData(accountDetails) {
  /** @type {IndexUpdate[]} */
  const updateList = [];
  /** @type {Partial<Record<Letter, IndexUpdate>>} */
  const updateByLetter = {};

  /** @type {string | [string, string]} */
  const value = accountDetails.displayName ? [accountDetails.shortHandle, accountDetails.displayName] : accountDetails.shortHandle;

  /** @type {string[]} */
  const wordStarts = [];
  getWordStartsLowerCase(accountDetails.shortHandle, wordStarts);
  getWordStartsLowerCase(accountDetails.displayName, wordStarts);

  for (const prefix of wordStarts) {
    const letter = /** @type {Letter} */(prefix[0]);
    let letterUpdates = updateList.find(update => update.letter === prefix[0]);
    if (letterUpdates) {
      letterUpdates.prefixes += prefix.slice(1);
    } else {
      updateList.push(letterUpdates = {
        letter,
        shortDID: accountDetails.shortDID,
        value,
        prefixes: prefix.slice(1)
      });
      updateByLetter[letter] = letterUpdates;
    }
  }

  return { list: updateList, byLetter: updateByLetter };
}

/**
 * @param {string} shortDID
 * @param {import('./old-letter-map').OldLetterMap[]} maps
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
/** @param {string | null | undefined} str @param {string[]} wordStarts */
export function getWordStartsLowerCase(str, wordStarts = []) {
  if (!str) return wordStarts || [];

  if (!wordStarts) wordStarts = [];

  str.replace(wordStartRegExp, function (match) {
    const wordStart = match?.slice(0, 3).toLowerCase();
    if (wordStart?.length === 3 && wordStarts.indexOf(wordStart) < 0)
      wordStarts.push(wordStart);
    return match;
  });

  return wordStarts;
}