// @ts-check

import React, { useEffect, useState } from 'react';
import { Button, TextField } from '@mui/material';

import './auth-entry.css';

/**
 * @param {{
 *  disabled?: boolean,
 *  onStart: (auth: string) => void
 * }} _
 */
export function AuthEntry({ disabled, onStart }) {
  const [auth, setAuth] = useState(getStoredAuth);
  return (
    <span className='auth-entry'>
      <Button
        variant='contained'
        disabled={disabled}
        onClick={() => onStart(
          auth === KEY_EMOJI ? getLocalStorageAuthActual() || '' : auth)}>
        <span className='auth-entry-start-button-label'>Save</span>
      </Button>
      <TextField
        label={<span className='auth-entry-input-label'>GitHub auth token</span>}
        autoComplete='on'
        size='small'
        value={auth}
        disabled={disabled}
        onChange={e => setAuth(e.target.value)} />
    </span>
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