/**
 * turn-rail — node half (host side).
 *
 * 1. Registers the `turn-rail-history` session projection: folds the FULL
 *    session log into a compact list of the user's messages
 *    [{ seq, time, text }] — a few KB even for long sessions, delivered to the
 *    browser through the standard projection channel (history-tail baseline +
 *    live push frames), so the client rail can show every turn without loading
 *    the whole conversation.
 *
 * 2. Registers the `/turn-rail-delete <seq>` slash command: logically deletes
 *    one user message and its reply turn through the compaction prune
 *    protocol — a `compaction/prune` shadow-price event immediately followed
 *    by a surface `replace` that swaps the whole turn for one EMPTY assistant
 *    placeholder (empty content derives to null, so it never enters the model
 *    context; the visible "（已删除）" marker is DOM-injected client-side).
 *    Shadowed events stop contributing to the derived LLM history, the chat
 *    surface, and this projection. The append-only log keeps the original
 *    events, exactly like dsh's own compaction.
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

/**
 * The deleted-turn marker text the client injects into the transcript.
 * The surface replacement node itself carries EMPTY content (see deleteTurn)
 * so it stays out of the model context — this string is UI-only.
 */
const DELETED_MARKER = '（已删除）'

/**
 * State: the rail entries (one per real user message) plus the durable list
 * of deleted user-message seqs. The client uses `deleted` to hide the
 * shadowed chat rows, including after a page reload — dsh keeps shadowed
 * content in the human transcript by design, so the plugin owns the hiding.
 */
const init = () => ({ entries: [], deleted: [] })

/**
 * Pure fold: append user/message events, ignore everything else, and honour
 * `compaction/prune` deletions by dropping the shadowed seqs and recording
 * the deleted user-message seq (the range always starts at it). Same-reference
 * returns keep the projection framework's change detection cheap.
 */
function apply(state, event) {
  if (event.type === 'compaction/prune') {
    const data = event.data
    const shadowed = data !== null && typeof data === 'object' && Array.isArray(data.shadowedSeqs)
      ? new Set(data.shadowedSeqs)
      : null
    if (shadowed === null) return state
    const entries = state.entries.filter(entry => !shadowed.has(entry.seq))
    // Only record a deleted USER-message seq. dsh's own tool-result pruner also
    // emits `compaction/prune`, and its first shadowed seq is a `tool/result`,
    // not a user message — recording it would pollute `deleted` and spur a
    // change notification. Gate on that seq actually being one of the user
    // entries we just dropped.
    const firstShadowed = data.shadowedSeqs.length > 0 ? data.shadowedSeqs[0] : null
    const wasUserEntry = firstShadowed !== null
      && state.entries.some(entry => entry.seq === firstShadowed)
    const deleted = wasUserEntry && !state.deleted.includes(firstShadowed)
      ? state.deleted.concat([firstShadowed])
      : state.deleted
    if (entries.length === state.entries.length && deleted === state.deleted) return state
    return { entries, deleted }
  }
  if (event.type !== 'user/message') return state
  const data = event.data
  const source = data !== null && typeof data === 'object' ? data.source : undefined
  if (source === null || typeof source !== 'object' || source.kind !== 'user') return state
  const next = state.entries.concat([{
    seq: event.seq,
    time: event.time,
    text: extractText(data.content),
  }])
  return { entries: next, deleted: state.deleted }
}

/** Fabricate a stable message id for the marker message (Node host: crypto exists). */
function newMessageId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return 'turn-rail-delete-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)
}

/**
 * Delete one user message and its whole reply turn from the model-visible
 * surface. Returns a command result the registry turns into command feedback.
 * @param session - the session whose surface is rewritten.
 * @param targetSeq - seq of the user/message surface node to delete.
 * @returns success/error command result.
 */
function deleteTurn(session, targetSeq) {
  const events = session.events
  const surface = session.surface

  const idx = surface.nodes.indexOf(targetSeq)
  if (idx === -1) {
    return { kind: 'error', text: `删除失败：未找到 seq ${targetSeq} 对应的消息` }
  }
  const target = events[targetSeq]
  if (target === undefined || target.type !== 'user/message') {
    return { kind: 'error', text: '删除失败：只能删除用户消息' }
  }

  // Guard: an open (still generating) turn anywhere in the log makes the
  // surface unstable; require the user to stop first.
  let lastStartSeq = -1
  let lastEndSeq = -1
  for (const event of events) {
    if (event.type === 'turn/start') lastStartSeq = event.seq
    if (event.type === 'turn/end') lastEndSeq = event.seq
  }
  if (lastStartSeq > lastEndSeq) {
    return { kind: 'error', text: '删除失败：当前有正在进行的轮次，请先停止再删除' }
  }

  // Range: from the target user/message up to (excluding) the next
  // user/message — the whole reply turn, including tool results.
  let endIdx = idx
  for (let i = idx + 1; i < surface.nodes.length; i += 1) {
    const nodeEvent = events[surface.nodes[i]]
    if (nodeEvent !== undefined && nodeEvent.type === 'user/message') break
    endIdx = i
  }
  const shadowedSeqs = surface.nodes.slice(idx, endIdx + 1)
  const startSeq = shadowedSeqs[0]
  const endSeq = shadowedSeqs[shadowedSeqs.length - 1]

  // Marker provenance: reuse the deleted reply's source when one exists, else
  // the most recent assistant message source in the session. The persistence
  // validator requires a model source with NON-EMPTY provider/model strings
  // (`hasProviderModel`), so a bare {kind:'model'} fallback would corrupt the
  // session on restore — keep the last-resort values concrete.
  let source = null
  let turn = -1
  let step = 0
  for (const seq of shadowedSeqs) {
    const nodeEvent = events[seq]
    if (nodeEvent !== undefined && nodeEvent.type === 'assistant/message') {
      turn = typeof nodeEvent.data.turn === 'number' ? nodeEvent.data.turn : turn
      step = typeof nodeEvent.data.step === 'number' ? nodeEvent.data.step : step
      if (nodeEvent.data.message !== null && typeof nodeEvent.data.message === 'object'
        && nodeEvent.data.message.source !== null && typeof nodeEvent.data.message.source === 'object'
        && typeof nodeEvent.data.message.source.provider === 'string' && nodeEvent.data.message.source.provider.length > 0
        && typeof nodeEvent.data.message.source.model === 'string' && nodeEvent.data.message.source.model.length > 0) {
        source = nodeEvent.data.message.source
      }
    }
  }
  if (source === null) {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i]
      if (event.type === 'assistant/message'
        && event.data.message !== null && typeof event.data.message === 'object'
        && event.data.message.source !== null && typeof event.data.message.source === 'object'
        && typeof event.data.message.source.provider === 'string' && event.data.message.source.provider.length > 0
        && typeof event.data.message.source.model === 'string' && event.data.message.source.model.length > 0) {
        source = event.data.message.source
        break
      }
    }
  }
  if (source === null) {
    source = { kind: 'model', provider: 'turn-rail', model: 'turn-rail-delete' }
  }
  if (turn === -1) {
    // No assistant content in this turn (stopped before any output): take the
    // turn number from the turn/start boundary that contains the range.
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i]
      if (event.seq <= endSeq && event.type === 'turn/start' && typeof event.data.turn === 'number') {
        turn = event.data.turn
        break
      }
    }
    if (turn === -1) turn = 0
  }

  const pruneEvent = session.append('compaction/prune', {
    shadowedRange: { start: startSeq, end: endSeq },
    shadowedSeqs: [...shadowedSeqs],
    shadowedTokenCount: 0,
  })
  session.append('assistant/message', {
    turn,
    step,
    message: {
      id: newMessageId(),
      role: 'assistant',
      // Empty content: deriveEventMessage maps an empty assistant message to
      // null, so this placeholder never enters the model context. The visible
      // "（已删除）" marker is injected client-side (see client.js), not here.
      content: [],
      source,
    },
  }, {
    surfaceOp: { op: 'replace', start: startSeq, end: endSeq },
    sourceEventSeqs: [pruneEvent.seq, ...shadowedSeqs],
  })

  return { kind: 'success', text: '已删除该条消息及其回复' }
}

export default {
  name: 'turn-rail',
  apply(ctx) {
    // Projection: follow the shipped pattern — activate only when a projection
    // registry is composed (headless assemblies stay unaffected).
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      projectionCtx.sessionProjections.register({
        key: 'turn-rail-history',
        stateSchema: zod.object({
          entries: zod.array(zod.object({
            seq: zod.number(),
            time: zod.number(),
            text: zod.string(),
          })),
          deleted: zod.array(zod.number()),
        }),
        init,
        apply,
        wire: {
          viewSchema: zod.object({
            entries: zod.array(zod.object({
              seq: zod.number(),
              time: zod.number(),
              text: zod.string(),
            })),
            deleted: zod.array(zod.number()),
          }),
          view: (state) => state,
        },
        stateVersion: 4,
      })
    })

    // Delete command: /turn-rail-delete <seq>. Guarded so a composition
    // without the commands service keeps the rail itself fully working.
    try {
      ctx.inject(['commands'], (commandsCtx) => {
        commandsCtx.commands.register({
          name: 'turn-rail-delete',
          description: '删除一条用户消息及其回复（内容将不再参与上下文，无法恢复）',
          handler(invocation) {
            const match = /^\s*(\d+)\s*$/.exec(invocation.rawInput)
            if (match === null) {
              return { kind: 'error', text: '用法：/turn-rail-delete <消息seq>' }
            }
            const targetSeq = Number(match[1])
            const session = invocation.agent.session
            return deleteTurn(session, targetSeq)
          },
        })
      })
    } catch (error) {
      console.warn('[turn-rail] commands service unavailable, message deletion disabled:', error)
    }
  },
}

/** Test/repair seams: the pure delete transition and the projection fold. */
export { apply, deleteTurn, DELETED_MARKER }
