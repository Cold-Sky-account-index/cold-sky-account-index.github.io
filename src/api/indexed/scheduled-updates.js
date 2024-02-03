// @ts-check

import { resolveHandleOrDID } from '../resolve-handle-or-did';
import { getWordStartsLowerCase } from './index-account';
import { getMaps } from './maps';
import { sourceFirehose } from './source-firehose';
import { sourceUnindexed } from './source-unindexed';

/**
 * @typedef {{
 *  letter: import('.').AZLetter,
 *  originalMap?: import('.').CompactMap,
 *  mapUpdates?: import('.').CompactMap,
 *  bucketUpdates?: { [prefix: string]: string | [string, string] }
 * }} AccountUpdateState
 */

export async function* scheduledUpdates() {
  /** @type {Map<string, number>} */
  const didPriorities = new Map();

  let reportNextBucket = () => { };
  /** @type {Promise<void>} */
  let waitForNextBucket = new Promise(resolve => reportNextBucket = resolve);

  const maps = await getMaps();

  let updates = {
    list: [],
    byLetter: {}
  };

  feedUnindexed();
  feedFirehose();

  while (true) {
    await waitForNextBucket;
    waitForNextBucket = new Promise(resolve => reportNextBucket = resolve);

    if (updates.length) {
      const report = updates;
      updates = {
        list: [],
        byLetter: {}
      };

      yield report;
    }
  }

  async function fetchIndex() {
    while (true) {
      const shortDID = getNextShortDID();

      const update = await updateIndex(shortDID);
      for (const entry of update.list) {
        updates.list.push(entry);
        // TODO: update byLetter too
      }

    }
  }

  function getNextShortDID() {
    let topPriorityShortDID = '';
    let topPriority = 0;

    for (const [shortDID, priority] of didPriorities) {
      if (priority > topPriority) {
        topPriority = priority;
        topPriorityShortDID = shortDID;
      }
    }

    return topPriorityShortDID;
  }

  async function feedUnindexed() {
    for await (const bucket of sourceUnindexed(Object.values(maps))) {
      for (const shortDID of bucket) {
        addDIDPriority(shortDID, 10);
      }
    }
  }

  async function feedFirehose() {
    for await (const bucket of sourceFirehose()) {
      for (const shortDID in bucket) {
        addDIDPriority(shortDID, bucket[shortDID]);
      }
    }
  }

  function addDIDPriority(shortDID, priority) {
    didPriorities.set(shortDID, priority + (didPriorities.get(shortDID) || 0));
  }

  async function updateIndex(shortDID) {
    const accountDetails = await resolveHandleOrDID(shortDID);
    const accountUpdates = indexAccountData(accountDetails);
    return accountUpdates;
  }
}


/**
 * @param {AccountInfo} accountDetails
 */
function indexAccountData(accountDetails) {
  const updateList = [];
  const updateByLetter = {};

  /** @type {string | [string, string]} */
  const value = accountDetails.displayName ? [accountDetails.shortHandle, accountDetails.displayName] : accountDetails.shortHandle;

  /** @type {string[]} */
  const wordStarts = [];
  getWordStartsLowerCase(accountDetails.shortHandle, wordStarts);
  getWordStartsLowerCase(accountDetails.displayName, wordStarts);

  for (const prefix of wordStarts) {
    const letter = /** @type {import('.').AZLetter} */(prefix[0]);
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

  return {
    list: updateList,
    byLetter: /** @type {Record<import('.').AZLetter, typeof updateList[0]>}*/(updateByLetter)
  };
}