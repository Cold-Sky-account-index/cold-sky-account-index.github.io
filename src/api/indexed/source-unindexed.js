import { loadKnownDIDs } from './known-dids';

/**
 * @param {{ [shortDID: string]: unknown }[]} indexedMaps
 */
export async function* sourceUnindexed(indexedMaps) {
  const indexedDIDs = new Set();
  for (const map of indexedMaps) {
    for (const key in map) {
      if (map[key]) indexedDIDs.add(key);
    }
  }

  for (const knownBucket of loadKnownDIDs()) {
    const filteredBucket = [];
    for (const shortDID in knownBucket) {
      if (!indexedDIDs.has(shortDID)) {
        filteredBucket.push(shortDID);
      }
    }

    if (filteredBucket.length)
      yield filteredBucket;
  }
}
