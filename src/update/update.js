// @ts-check

import React, { useEffect, useState } from 'react';

import { forAwait } from '../api/forAwait';
import { letters } from '../api/indexed';
import { getMaps } from '../api/indexed/maps';
import { Indexing } from './indexing';
import { InitMissingMaps } from './init-missing-maps';
import { LoadingMaps } from './loading-maps';

import './update.css';

export function Update() {
  const [update, setUpdate] = useState(/** @type {import('../api/indexed/maps').Progress | undefined} */(undefined));
  const maps = forAwait('getMaps', () => getMaps(update => {
    setUpdate(update);
  }));

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
    <Indexing maps={maps} />
  );
}