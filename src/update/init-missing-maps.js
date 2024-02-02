// @ts-check

import React, { useMemo, useState } from 'react';
import { letters } from '../api/indexed';
import { Button, TextField } from '@mui/material';
import { forAwait } from '../api/forAwait';

/**
 * @param {{
 *  maps: { [letter: string]: import('../api/indexed').CompactMap}
 * }} _
 */
export function InitMissingMaps({ maps }) {
  const mapsState = forAwait(maps, updateMaps);
  const mapCount = useMemo(() => {
    let mapCount = 0;
    for (const letter of letters) {
      if (maps?.[letter]) mapCount++;
    }
    return mapCount;
  }, [maps]);

  const [auth, setAuth] = useState('');

  return (
    <>
      <h2>Account index:
        {
          !mapCount ? undefined : <>{mapCount} maps exist </>
        }
        {
            !mapsState ? <> prepping the maps...</> :
              <> {mapsState.pending} to go...</>
        }
      </h2>
      <Button variant='contained' onClick={() => {
        mapsState?.applyWithAuth(auth);
      }}>Start</Button>
      <TextField
        label='GitHub auth token'
        autoComplete='on'
        value={auth}
        onChange={e => setAuth(e.target.value)} />
      {!mapsState ? undefined :
        <div>
          {
            mapsState.state.map((map, index) => 
              <span
                className='letter-state'
                title={map.state === 'error' ? map.error.stack : undefined}
                key={map.letter}>
                {map.letter} <b>{map.state || 'OK'}</b>
                {map.state !== 'fetching' ? undefined : (/** @type {*} */(map)?.progress * 100).toFixed() + '%'}
                {' '}
              </span>
            )
          }
        </div>
      }
    </>
  );
}

/** @param {{ [letter: string]: import('../api/indexed').CompactMap}} maps */
async function* updateMaps(maps) {
  let applyWithAuth = (auth) => { };
  let authPromise = new Promise(resolve => applyWithAuth = resolve);

    let yieldResolve = () => { };
    /** @type {Promise<void>} */
    let yieldPromise = new Promise(resolve => yieldResolve = resolve);

    let pending = 0;

    /**
     * @type {(
     *  (import('../api/indexed/maps').LetterMap & {state?: undefined }) |
     *  (import('../api/indexed/maps').LetterMap & {state: 'fetching', progress: number }) |
     *  (import('../api/indexed/maps').LetterMap & {state: 'new' }) |
     *  (import('../api/indexed/maps').LetterMap & {state: 'error', error: Error }) |
     *  (import('../api/indexed/maps').LetterMap & {state: 'updated' }) |
     *  { letter: string, state: 'fetching' }
     * )[]}
     */
    const state = letters.split('').map(letter =>
      maps[letter] || workLetter(letter));

    while (pending) {
      await yieldPromise;
      yieldPromise = new Promise(resolve => yieldResolve = resolve);

      yield { state, pending, applyWithAuth };
    }


    /** @param {string} letter */
  function workLetter(letter) {
    pending++;
    const index = letters.indexOf(letter);

    const result = { letter, state: 'fetching', progress: 0 };
    startFetching();
    return result;

    async function startFetching() {
      let finished = false;
      const newMap = await createOriginalMap(letter, ({ pending, complete }) => {
        if (finished) return;
        result.progress = complete / (pending + complete);
        yieldResolve();
      });
      finished = true;
      state[index] = /** @type {*} */({ ...newMap, state: 'new' });
      yieldResolve();

      while (true) {
        const authPromiseToGo = authPromise;
        const auth = await authPromiseToGo;
        try {
          await storeNewMap({ letter, map: newMap, auth });
          state[index] = /** @type {*} */({ ...newMap, state: 'updated' });
          pending--;
          yieldResolve();
          break;
        } catch (error) {
          state[index] = /** @type {*} */({ ...newMap, state: 'error', error });
          if (authPromise === authPromiseToGo)
            authPromise = new Promise(resolve => applyWithAuth = resolve);
          yieldResolve();
        }
      }
    }
  }
}
