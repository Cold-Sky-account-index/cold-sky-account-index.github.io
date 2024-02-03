// @ts-check

import React from 'react';

import { azLetters } from '../api/indexed';
import './letter-layout.css';

const lettersArray = azLetters.split('');

/**
 * @param {{
 *  title?: React.ReactNode;
 *  subtitle?: React.ReactNode;
 *  headers?: React.ReactNode[] | (({ letter, header }: { letter: string, header: true }) => React.ReactNode);
 *  children?: React.ReactNode[] | (({ letter, header }: { letter: string, header: false }) => React.ReactNode);
 *  status?: React.ReactNode;
 * }} _
 */
export function LetterLayout({ title, subtitle, headers, children, status }) {
  return (
    <div className='letter-layout'>
      <h2 className='letter-layout-title'>{title || 'Account index'}</h2>
      {
        !subtitle ? undefined : <div className='letter-layout-subtitle'>{subtitle}</div>
      }
      {
        lettersArray.map((letter, i) => {
          const header = typeof headers === 'function' ? headers({ letter, header: true }) : headers?.[i];
          return (
            <div key={letter} className={'letter-layout-header-letter letter-layout-header-letter-' + letter}>
              {header || letter}
            </div>
          );
        })
      }
      {
        lettersArray.map((letter, i) => {
          const content = typeof children === 'function' ? children({ letter, header: false }) : children?.[i];
          return (
            <div key={letter} className={'letter-layout-content-letter letter-layout-content-letter-' + letter}>
              {content || undefined}
            </div>
          );
        })
      }
      {
        !status ? undefined : <div className='letter-layout-status'>{status}</div>
      }
    </div>
  );
}