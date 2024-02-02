// @ts-check

import { breakBskyURL, shortenDID } from '..';
import { firehose } from '../firehose';

/**
 * @param {(shortDID: string) => number} [filterShortDIDs]
 */
export async function* sourceFirehose(filterShortDIDs) {

  /** @type {{ [shortDID: string]: number }} */
  let shortDIDs = {};
  let addedAny = false;

  for await (const block of firehose()) {
    if (!block?.length) continue;

    for (const entry of block) {
      if (!entry.messages?.length) continue;

      for (const msg of entry.messages) {
        collectShortDIDs(msg);
      }
    }

    if (addedAny) {
      const report = shortDIDs;
      shortDIDs = {};
      addedAny = false;
      yield report;
    }
  }


  /**
 * 
 * @param {import('../firehose').FirehoseMessage} msg 
 */
  function collectShortDIDs(msg) {
    addShortDID(msg.repo);
    switch (msg.$type) {
      case 'app.bsky.feed.like':
        addShortDID(breakBskyURL(msg.subject?.uri)?.shortDID);
        return;

      case 'app.bsky.feed.post':
        addShortDID(breakBskyURL(msg.reply?.parent?.uri)?.shortDID);
        addShortDID(breakBskyURL(msg.reply?.root?.uri)?.shortDID);
        if (msg.embed?.$type === 'app.bsky.embed.record')
          addShortDID(breakBskyURL(/** @type {*} */(msg.embed?.record)?.uri)?.shortDID);
        return;

      case 'app.bsky.feed.repost':
        addShortDID(breakBskyURL(msg.subject?.uri)?.shortDID);
        return;

      case 'app.bsky.feed.threadgate':
        // TODO extend
        return;

      case 'app.bsky.graph.follow':
        addShortDID(msg.subject);
        return;

      case 'app.bsky.graph.block':
        addShortDID(msg.subject);
        return;

      case 'app.bsky.graph.list':
        // TODO extend
        return;

      case 'app.bsky.graph.listitem':
        addShortDID(msg.subject);
        return;

      case 'app.bsky.actor.profile':
        return;
    }
  }

  /**
   * @param {string | undefined} did
   * @param {number} [ratio]
   */
  function addShortDID(did, ratio) {
    if (!did) return;
    const shortDID = shortenDID(did);
    let increment =
      (typeof filterShortDIDs === 'function' ? filterShortDIDs(did) : 1) * (ratio || 1);
    if (!increment) return;

    shortDIDs[shortDID] = (shortDIDs[shortDID] || 0) + increment;
    addedAny = true;
  }
}