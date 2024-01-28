// @ts-check

import { Button, TextField } from '@mui/material';
import React, { useEffect, useState } from 'react';

/**
 * @param {{
 *  disabled?: boolean,
 *  onStart: (auth: string) => void
 * }} _
 */
export function AuthEntry({ disabled, onStart }) {
  const [auth, setAuth] = useState(getStoredAuth);
  return (
    <>
      <Button variant='contained' onClick={() => onStart(
        auth === KEY_EMOJI ? getLocalStorageAuthActual() || '' : auth)
      }>Start</Button>
      <TextField
        label='GitHub auth token'
        autoComplete='on'
        value={auth}
        onChange={e => setAuth(e.target.value)} />
    </>
  );
}

const AUTH_STORAGE_KEY = 'github-auth-cached';
const KEY_EMOJI = '\ud83d\udd11';

function getLocalStorageAuthActual() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) || undefined;
  } catch (error) {
    console.warn('Cannot access localStorage for auth token ', error);
  }
}

function getStoredAuth() {
  return getLocalStorageAuthActual() ? KEY_EMOJI : '';
}