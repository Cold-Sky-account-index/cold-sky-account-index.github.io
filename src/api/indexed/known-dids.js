// @ts-check

import { streamBuffer } from '../akpa';
import { retryFetch } from '../retryFetch';

const didLetters = '234567abcdefghjiklmnopqrstuvwxyz';

/**
 * @typedef {{
 *  shortDIDs: string[],
 *  errors?: { [twoLetterKey: string]: import('../retryFetch').RetryArgs }
 * }} KnownDIDs
 */

/**
 * @returns AsyncGenerator<{
 *  shortDIDs: string[],
 *  errors?: { [twoLetterKey: string]: RetryArgs | undefined } | undefined
 * }>
 */
export function loadKnownDIDs() {
  return streamBuffer(/** @param {import('../akpa').StreamParameters<undefined, KnownDIDs>} stream */stream => {
    let remainingBuckets = 0;

    for (const firstLetter of didLetters) {
      for (const secondLetter of didLetters) {
        remainingBuckets++;
        loadBucketAndTriggerPromise(firstLetter, secondLetter);
      }
    }

    /**
     * @param {string} firstLetter
     * @param {string} secondLetter
     */
    async function loadBucketAndTriggerPromise(firstLetter, secondLetter) {
      const shortDIDs = await loadBucket(firstLetter, secondLetter, retryArgs => {
        if (stream.isEnded) return;
        stream.yield(undefined, report => {
          if (!report) report = { shortDIDs: [] };
          if (!report.errors) report.errors = {};
          report.errors[firstLetter + secondLetter] = retryArgs;
          return report;
        });
      });

      if (stream.isEnded) return;

      stream.yield(
        undefined,
        report => {
          if (!report) return { shortDIDs };
          report.shortDIDs = report.shortDIDs.concat(shortDIDs);
          if (report.errors?.[firstLetter + secondLetter])
            delete report.errors[firstLetter + secondLetter];
          return report;
        });
      
      remainingBuckets--;
      if (!remainingBuckets) stream.complete();
    }
  });
}

/**
 * @param {string} firstLetter
 * @param {string} secondLetter
 * @param {({}: import('../retryFetch').RetryArgs) => void} [onretry]
 */
function loadBucket(firstLetter, secondLetter, onretry) {
  let shardURL = getShardBucketURL(firstLetter, secondLetter);
  return retryFetch(shardURL, { onretry }).then(x => x.json());
}

/** @param {string} firstLetter @param {string} secondLetter */
function getShardBucketURL(firstLetter, secondLetter) {
  return 'https://dids.colds.ky/' + firstLetter + '/' + firstLetter + secondLetter + '.json';
}