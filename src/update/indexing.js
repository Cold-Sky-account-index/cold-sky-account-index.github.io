// @ts-check

import React, { useMemo, useState } from 'react';

import { resolveHandleOrDID, shortenDID } from '../api';
import { firehose } from '../api/firehose';
import { forAwait } from '../api/forAwait';
import { getPrefixes, getWordStartsLowerCase } from '../api/indexed/maps';
import { AuthEntry } from './auth-entry';
import { LetterLayout } from './letter-layout';

import './indexing.css';
import { letters } from '../api/indexed';

/**
 * @param {{
 *  maps: { [letter: string]: import('../api/indexed/maps').CompactMap }
 * }} _ 
 */
export function Indexing({ maps }) {
  const [[startWithAuth, clickStartWithAuth]] = useState(() => {
    /** @type {(auth: string) => Promise<void>} */
    let clickStartWithAuth = async () => { };
    /** @type {Promise<{ auth: string, resolveAuth(): void, rejectAuth(): void }>} */
    const startWithAuth = new Promise(resolve => {
      clickStartWithAuth = (auth) => new Promise((resolveAuth, rejectAuth) => {
        resolve({
          auth,
          resolveAuth,
          rejectAuth
        });
      });
    });
    return /** @type {[Promise<{ auth: String, resolveAuth(): void, rejectAuth(): void }>, (auth: string) => Promise]} */([
      startWithAuth,
      clickStartWithAuth]);
  });

  const [didsPrefixes, average] = useMemo(() => {
    /** @type {Map<string, string[]>} */
    const allDids = new Map();
    for (const letter of Object.keys(maps)) {
      const map = maps[letter];
      for (const shortDID of Object.keys(map)) {
        if (shortDID === 'letter') continue;
        let prefixes = allDids.get(shortDID);
        if (!prefixes) allDids.set(shortDID, prefixes = []);
        const mapPrefixes = getPrefixes(shortDID, letter, map);
        if (mapPrefixes) {
          for (const prefix of mapPrefixes) {
            prefixes.push(map.letter + prefix);
          }
        }
      }
    }

    const morePrefixesFirst = [...allDids.entries()].map(([shortDID, prefixes]) => ({ shortDID, prefixes }));
    morePrefixesFirst.sort((a, b) => b.prefixes.length - a.prefixes.length);
    let total = 0;
    for (const { prefixes } of morePrefixesFirst) total += prefixes.length;
    return [morePrefixesFirst, total / morePrefixesFirst.length];
  }, [maps]);

  const [lastUpdateState] = useState({
    /** @type {Partial<Record<import('../api/indexed/maps').Letter, IndexUpdate>> | undefined} */
    lastUpdate: undefined
  });

  const progress = forAwait(maps, runFirehoseAndUpdate);

  const progressLatestByLetter = progress?.accountUpdates?.byLetter;
  const progressAllByLetter = progress?.allByLetter;

  if (progressLatestByLetter) {
    lastUpdateState.lastUpdate = progressLatestByLetter;
  }

  return (
    <LetterLayout
      title='Account indexing'
      subtitle={<AuthEntry onStart={clickStartWithAuth} />}
      status={
        <>
          <b>{didsPrefixes.length.toLocaleString()}</b> accounts, prefixes from <b>{didsPrefixes[0].prefixes.length}</b> to <b>{didsPrefixes[didsPrefixes.length - 1].prefixes.length}</b> (average <b>{average.toFixed(1).replace(/\.0$/, '')}</b>).
        </>
      }>
      {({ letter }) =>
        <LetterMapStatus
          map={maps[letter]}
          progressLatest={lastUpdateState.lastUpdate?.[letter]}
          progressAll={progressAllByLetter?.[letter]}
        />}
    </LetterLayout>
  );
}

/**
 * @param {{
 *  map: import('../api/indexed/maps').CompactMap,
 *  progressAll?: IndexUpdate[],
 *  progressLatest?: IndexUpdate
 * }} _
 */
function LetterMapStatus({ map, progressAll, progressLatest }) {
  const keys = useMemo(() => Object.keys(map).sort(), [map]);

  return (
    <div className='letter-indexing-progress-status'>
      <div className='letter-indexing-progress-status-preexisting'>
        {keys.length.toLocaleString()}
      </div>
      <div className={
        progressLatest && !progressLatest.prefixes ?
          'letter-indexing-progress-status-updates letter-indexing-progress-status-updates-removals' :
          'letter-indexing-progress-status-updates'
      }>
        {
          !progressLatest ? undefined : 
            <>
              {typeof progressLatest.value === 'string' ? progressLatest.value : progressLatest.value[1]}
              {' '}
              <b>
                {progressLatest?.prefixes}
              </b>
            </>
        }
      </div>
      <div className='letter-indexing-progress-status-accumulated'>
        {progressAll?.length.toLocaleString()}
      </div>
    </div>
  );
}

/**
 * @typedef {{
   *  letter: import('../api/indexed/maps').Letter,
   *  shortDID: string,
   *  value: string | [handle: string, displayName: string],
   *  prefixes: string
   * }} IndexUpdate
 */

/**
 * @param {{ [letter: string]: import('../api/indexed/maps').CompactMap }} maps
 */
async function* runFirehoseAndUpdate(maps) {
  /** @type {IndexUpdate[]} */
  const allIndexUpdates = [];
  /** @type {Partial<Record<import('../api/indexed/maps').Letter, IndexUpdate[]>>}*/
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

        for (const letter of letters) {
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
  /** @type {Partial<Record<import('../api/indexed/maps').Letter, IndexUpdate>>} */
  const updateByLetter = {};

  /** @type {string | [string, string]} */
  const value = accountDetails.displayName ? [accountDetails.shortHandle, accountDetails.displayName] : accountDetails.shortHandle;

  /** @type {string[]} */
  const wordStarts = [];
  getWordStartsLowerCase(accountDetails.shortHandle, wordStarts);
  getWordStartsLowerCase(accountDetails.displayName, wordStarts);

  for (const prefix of wordStarts) {
    const letter = /** @type {import('../api/indexed/maps').Letter} */(prefix[0]);
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
