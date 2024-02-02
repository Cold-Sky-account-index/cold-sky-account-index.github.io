import { loadKnownDIDs } from './known-dids';

/**
 * @param {import('.').CompactMap[]} indexedMaps
 */
export async function* sourceUnindexed(indexedMaps) {
  const indexedDIDs = new Set();
  for (const map of indexedMaps) {
    for (const key in map) {
      indexedDIDs.add(key);
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
