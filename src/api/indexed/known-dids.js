// @ts-check

const didLetters = '234567abcdefghjiklmnopqrstuvwxyz';

export async function* loadKnownDIDs() {
  let reportNextBucket = () => { };
  /** @type {Promise<void>} */
  let waitForNextBucket = new Promise(resolve => reportNextBucket = resolve);
  /** @type {string[]} */
  let buffer = [];
  let remainingBuckets = 0;

  for (const firstLetter of didLetters) {
    for (const secondLetter of didLetters) {
      remainingBuckets++;
      loadBucketAndTriggerPromise(firstLetter, secondLetter);
    }
  }

  while (remainingBuckets) {
    await waitForNextBucket;
    const report = buffer;
    waitForNextBucket = new Promise(resolve => reportNextBucket = resolve)
    buffer = [];
    yield report;
  }

  /**
   * @param {string} firstLetter
   * @param {string} secondLetter
   */
  async function loadBucketAndTriggerPromise(firstLetter, secondLetter) {
    const shortDIDs = await loadBucket(firstLetter, secondLetter);

    remainingBuckets--;
    buffer = buffer.length ? buffer.concat(shortDIDs) : shortDIDs;
    reportNextBucket();
  }
}

let anyBucketSucceededDirectly = false;

/**
 * @param {string} firstLetter
 * @param {string} secondLetter
 */
async function loadBucket(firstLetter, secondLetter) {
  const start = Date.now();
  let afterError = false;
  while (true) {
    try {
      let shardURL = getShardBucketURL(firstLetter, secondLetter);
      let directFetch = true;
      if (afterError && !anyBucketSucceededDirectly) {
        // Error might be CORS, try with proxy
        // (but keep trying direct fetches too, in case it was a transient error)
        if (Math.random() > 0.5) {
          directFetch = false;
          shardURL = 'https://corsproxy.io/?' + shardURL + '&t=' + Date.now();
        }
      }

      const shortDIDs = await fetch(shardURL).then(x => x.json());

      if (directFetch)
        anyBucketSucceededDirectly = true;

      return shortDIDs;
    } catch (error) {
      afterError = true;
      const waitFor = Math.min(
        30000,
        Math.max(300, (Date.now() - start) / 3)
      ) * (0.7 + Math.random() * 0.6);

      console.warn('delay ', waitFor, 'ms ', error);
      await new Promise(resolve => setTimeout(resolve, waitFor));
    }
  }
}

/** @param {string} firstLetter @param {string} secondLetter */
function getShardBucketURL(firstLetter, secondLetter) {
  return 'https://dids.colds.ky/' + firstLetter + '/' + firstLetter + secondLetter + '.json';
}