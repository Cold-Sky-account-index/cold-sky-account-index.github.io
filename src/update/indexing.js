// @ts-check

import React, { useMemo, useState } from 'react';

import { forAwait } from '../api/forAwait';
import { getPrefixes } from '../api/indexed/maps';
import { AuthEntry } from './auth-entry';
import { LetterLayout } from './letter-layout';

import './indexing.css';
import { runFirehoseAndUpdate } from '../api/indexed';

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
    /** @type {Partial<Record<import('../api/indexed').AZLetter, import('../api/indexed').IndexUpdate>> | undefined} */
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
 *  progressAll?: import('../api/indexed').IndexUpdate[],
 *  progressLatest?: import('../api/indexed').IndexUpdate
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
