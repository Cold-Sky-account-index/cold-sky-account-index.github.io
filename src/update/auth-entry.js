// @ts-check

import React, { useEffect, useState } from 'react';
import { Button, TextField } from '@mui/material';

import './auth-entry.css';
import { isPromise } from '../api';

/**
 * @param {{
 *  disabled?: boolean,
 *  onStart?: (auth: string) => void | Promise<void>
 * }} _
 */
export function AuthEntry({ disabled, onStart }) {

  const [auth, setAuth] = useState(getStoredAuth);
  const [inProgress, setInProgress] = useState(false);

  return (
    <span className='auth-entry'>
      <Button
        variant='contained'
        disabled={typeof disabled === 'boolean' ? disabled : inProgress}
        onClick={handleButtonClick}>
        <span className='auth-entry-start-button-label'>Save</span>
      </Button>
      <TextField
        label={<span className='auth-entry-input-label'>GitHub auth token</span>}
        autoComplete='on'
        size='small'
        value={auth}
        disabled={typeof disabled === 'boolean' ? disabled : inProgress}
        onChange={e => setAuth(e.target.value)}
        onKeyDown={handleTextFieldKeyDown}
      />
    </span>
  );

  /** @param {import('react').KeyboardEvent<HTMLInputElement>} e */
  function handleTextFieldKeyDown(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault?.();
      e.stopPropagation?.();

      handleButtonClick();
    }
  }

  async function handleButtonClick() {
    if (typeof onStart !== 'function') return;

    const useAuth = auth === KEY_EMOJI ? getLocalStorageAuthActual() || '' : auth;
    const saveAuthOnSuccess = auth !== KEY_EMOJI;
    var startPromise;
    try {
      startPromise = onStart(useAuth);
    } catch (error) {
      //
    }

    if (isPromise(startPromise)) {
      setInProgress(true);
      try {
        await startPromise;
      } catch (error) {
        // 
      }
      setInProgress(false);

      if (saveAuthOnSuccess) {
        saveAuth(useAuth);
      }
    }
  }
}

/** @param {string} auth */
function saveAuth(auth) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, auth);
  } catch (error) {
    console.warn('Cannot store auth token into localStorage ', error);
  }
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