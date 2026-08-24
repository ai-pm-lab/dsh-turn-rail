/**
 * turn-rail — node half (host side).
 *
 * Registers the `turn-rail-history` session projection: folds the FULL
 * session log into a compact list of the user's messages
 * [{ seq, time, text }] — a few KB even for long sessions, delivered to the
 * browser through the standard projection channel (history-tail baseline +
 * live push frames), so the client rail can show every turn without loading
 * the whole conversation.
 */
import { z as zod } from 'zod'

/** Extract displayable text from ContentBlock[]. */
function extractText(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && typeof block.text === 'string') {
      parts.push(block.text)
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** State: one entry per real user message (source kind 'user'). */
const init = () => []

/** Pure fold: append user/message events, ignore everything else. */
function apply(state, event) {
  if (event.type !== 'user/message') return state
  const data = event.data
  const source = data !== null && typeof data === 'object' ? data.source : undefined
  if (source === null || typeof source !== 'object' || source.kind !== 'user') return state
  const next = state.concat([{
    seq: event.seq,
    time: event.time,
    text: extractText(data.content),
  }])
  return next
}

export default {
  name: 'turn-rail',
  apply(ctx) {
    // Follow the shipped projection pattern: activate only when a projection
    // registry is composed (headless assemblies stay unaffected).
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      projectionCtx.sessionProjections.register({
        key: 'turn-rail-history',
        stateSchema: zod.array(zod.object({
          seq: zod.number(),
          time: zod.number(),
          text: zod.string(),
        })),
        init,
        apply,
        wire: {
          viewSchema: zod.array(zod.object({
            seq: zod.number(),
            time: zod.number(),
            text: zod.string(),
          })),
          view: (state) => state,
        },
        stateVersion: 1,
      })
    })
  },
}
