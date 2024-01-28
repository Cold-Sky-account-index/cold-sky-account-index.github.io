// @ts-check

import React, { useMemo, useState } from 'react';

import { letters } from '../api/indexed';
import './indexing.css';
import { LetterLayout } from './letter-layout';
import { AuthEntry } from './auth-entry';

/**
 * @param {{
 *  maps: { [letter: string]: import('../api/indexed/maps').LetterMap }
 * }} _ 
 */
export function Indexing({ maps }) {
  const [[startWithAuth, clickStartWithAuth]] = useState(() => {
    /** @type {(auth: string) => void} */
    let clickStartWithAuth = () => { };
    /** @type {Promise<string>} */
    const startWithAuth = new Promise(resolve => clickStartWithAuth = resolve);
    return /** @type {[Promise<string>, (auth: string) => void]} */([startWithAuth, clickStartWithAuth]);
  });

  const [didsPrefixes, average] = useMemo(() => {
    /** @type {Map<string, string[]>} */
    const allDids = new Map();
    for (const map of Object.values(maps)) {
      for (const shortDID of Object.keys(map)) {
        if (shortDID === 'letter') continue;
        let prefixes = allDids.get(shortDID);
        if (!prefixes) allDids.set(shortDID, prefixes = []);
        for (const prefix of map[shortDID].prefixes) {
          prefixes.push(map.letter + prefix);
        }
      }
    }

    const morePrefixesFirst = [...allDids.entries()].map(([shortDID, prefixes]) => ({ shortDID, prefixes }));
    morePrefixesFirst.sort((a, b) => b.prefixes.length - a.prefixes.length);
    let total = 0;
    for (const { prefixes } of morePrefixesFirst) total += prefixes.length;
    return [morePrefixesFirst, total / morePrefixesFirst.length];
  }, [maps]);

  return (
    <LetterLayout
      title='Account indexing'
      subtitle={<AuthEntry onStart={clickStartWithAuth} />}
      status={
        <>
          <b>{didsPrefixes.length.toLocaleString()}</b> accounts, prefixes from <b>{didsPrefixes[0].prefixes.length}</b> to <b>{didsPrefixes[didsPrefixes.length - 1].prefixes.length}</b> (average <b>{average.toFixed(1).replace(/\.0$/, '')}</b>).
        </>
      }>
      {({ letter }) => <LetterMapStatus map={maps[letter]} />}
    </LetterLayout>
  );
}

/** @param {{ map: import('../api/indexed/maps').LetterMap }} _ */
function LetterMapStatus({ map }) {
  const keys = useMemo(() => Object.keys(map).sort(), [map]);

  return (
    <div style={{ writingMode: 'vertical-rl', fontSize: '80%', textShadow: 'none', paddingTop: '1em' }}>
      {map.letter}{map[keys[0]].prefixes[0]}
      ... {keys.length.toLocaleString()} ...
      {map.letter}{map[keys[keys.length-1]].prefixes[0]}
    </div>
  );
}