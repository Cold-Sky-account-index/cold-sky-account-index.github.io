// @ts-check

import React, { useEffect, useState } from 'react';

import './update.css';
import { forAwait } from '../api/forAwait';
import { getMaps } from '../api/indexed/maps';
import { letters } from '../api/indexed';
import { InitMissingMaps } from './init-missing-maps';

export function Update() {
  const [update, setUpdate] = useState(/** @type {import('../api/indexed/maps').Progress | undefined} */(undefined));
  const maps = forAwait('getMaps', () => getMaps(/*update => {
    setUpdate(update);
  }*/));

  let mapCount = 0;
  for (const letter of letters) {
    if (maps?.[letter]) mapCount++;
  }

  return (
    <div className='update-bg'>
      {
        !maps ? <LoadingMaps progress={update} /> :
          mapCount < letters.length ? <MissingMaps maps={maps} mapCount={mapCount} /> :
          <LoadedMaps maps={maps} />
      }
    </div>
  );
}

/** @param {{ progress?: import('../api/indexed/maps').Progress }} _ */
function LoadingMaps({ progress }) {
  return (
    <h2>Account index: {
      !progress ? undefined :
        <>{progress.pending.length} to go</>
    }...</h2>
  );
}

function MissingMaps({ maps, mapCount }) {
  return (
    <InitMissingMaps maps={maps} />
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