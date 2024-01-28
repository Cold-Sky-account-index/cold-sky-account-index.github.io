// @ts-check

import React, { useMemo } from 'react';

import { letters } from '../api/indexed';
import './indexing.css';
import { LetterLayout } from './letter-layout';

/**
 * @param {{
 *  maps: { [letter: string]: import('../api/indexed/maps').LetterMap }
 * }} _ 
 */
export function Indexing({ maps }) {
  return (
    <LetterLayout
      title='Account indexing'
      status='Does it look right?'>
      {({ letter }) => <LetterMapStatus map={maps[letter]} />}
    </LetterLayout>
  );
}

/** @param {import('../api/indexed/maps').LetterMap} map */
function LetterMapStatus({ map }) {
  const keys = useMemo(() => Object.keys(map).sort(), [map]);

  return (
    <div style={{ writingMode: 'vertical-rl', fontSize: '80%', textShadow: 'none', paddingTop: '1em' }}>
      {map.letter}{map[keys[0]].prefixes[0]}
      ... {keys.length} ...
      {map.letter}{map[keys[keys.length-1]].prefixes[0]}
    </div>
  );
}