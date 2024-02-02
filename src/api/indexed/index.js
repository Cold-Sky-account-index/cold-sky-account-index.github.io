// @ts-check

export const letters = /** @type {string & Iterable<Letter>} */('abcdefghijklmnopqrstuvwxyz');

/**
 * @typedef { 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' |
 * 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' |
 * 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
 * } Letter
 */

/**
 * @typedef {{
 *  letter?: undefined,
 *  [shortDID: string]: string | undefined
 * }} CompactMap
 */

export { runFirehoseAndUpdate } from './index-account.js';
export { getMaps } from './maps.js';

/** @typedef {import('./index-account').IndexUpdate} IndexUpdate */