// @ts-check

import React from 'react';
import atproto from '@atproto/api';
import * as octokit from "octokit";

import * as wholeAPI from './api';
import { AutocompleteInput } from './autocomplete-input';
import { Link } from 'react-router-dom';

if (typeof window !== 'undefined') {
  window['atproto'] = atproto;
  window['octokit'] = octokit;
  window['coldsky'] = wholeAPI;
}

/**
 * @param {{
 *  title?: string,
 *  subtitle?: string,
 *  inputClassName?: string,
 *  inputPlaceholderText?: string,
 *  autocompleteArea?: React.ReactNode
 * }} _
 */
export function RootLayout({
  title,
  subtitle,
  inputClassName,
  inputPlaceholderText }) {
  
  const [showUpdateDIDs, setShowUpdateDIDs] = React.useState(false);

  return (
    <table className="top-table">
      <tbody>
        <tr>
          <td valign="middle" className="td-main">
            <Link className='top-left-link' to='update'>Update index</Link>
            <div className="div-outer">
              <div className="div-inner">
                <h1 className="title">{title ?? 'Cold Sky'}</h1>
                <div className="subtitle">{subtitle ?? 'social media up there'}</div>
                <AutocompleteInput
                  inputClassName={inputClassName}
                  inputPlaceholderText={inputPlaceholderText}
                  executeCommand={executeCommand} />
                {
                  !showUpdateDIDs ? undefined :
                    '<MaintainPanel />'
                }
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );


  async function executeCommand(commandName) {
    if (commandName === 'updateDIDs') {
      setShowUpdateDIDs(true);
      return;
    }
  
    const command = window['coldsky'][commandName];
    let result = await /** @type {*} */(command)();

    alert(
      typeof result === 'undefined' ? commandName + ' OK' :
        commandName + ' ' + JSON.stringify(result, null, 2)
    );
  }
}
