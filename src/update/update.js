// @ts-check

import React, { useEffect } from 'react';

import './update.css';
import { forAwait } from '../api/forAwait';
import { getMaps } from '../api/indexed/maps';
import { letters } from '../api/indexed';

export function Update() {
  const maps = forAwait('getMaps', () => getMaps());

  let mapCount = 0;
  for (const letter of letters) {
    if (maps?.[letter]) mapCount++;
  }

  return (
    <div className='update-bg'>
      {
        !maps ? <LoadingMaps /> :
          mapCount < letters.length ? <MissingMaps maps={maps} mapCount={mapCount} /> :
          <LoadedMaps maps={maps} />
      }
    </div>
  );
}

function LoadingMaps() {
  return <h2>Account index: loading state maps...</h2>;
}

function MissingMaps({ maps, mapCount }) {
  return (
    <>
      <h2>&nbsp; Account index: loaded {mapCount} maps</h2>
        {letters.length - mapCount} maps are missing.<br/>
        Proceed to init: auth and all...
    </>
  );
}

/**
 * @param {{
 *  maps: { [letter: string]: import('../api/indexed/maps').LetterMap }
 * }} _ 
 */
function LoadedMaps({ maps }) {
  return (
    <>
      <h2>&nbsp; Account index: all {letters.length} maps loaded</h2>
      Proceed to update: auth and all...
    </>
  );
}