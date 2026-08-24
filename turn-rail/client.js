/**
 * turn-rail — browser bundle (client half).
 *
 * DeepSeek web scrollNav port (panel-expand model, v5):
 * - a 34px × 300px glass strip, fixed right:16px, vertically centered
 * - one row per user message: an 8×2px indicator line + title text that is
 *   hidden until the strip is hovered
 * - hovering the strip turns the transparent strip into a real panel
 *   (surface background, border, shadow, pointer events), reveals each
 *   row's title, and the width grows up to 240px
 * - hovering a row shows a tooltip with the message preview (5 lines)
 * - clicking a row jumps the conversation to that turn; messages not yet
 *   loaded auto-page the chat's "load older" path
 * - scroll-spy via IntersectionObserver watchline highlights the active
 *   turn (brand color, line scales ×1.5); the active row stays visible
 *   inside the expanded panel
 * - full history comes from the host `turn-rail-history` projection
 *
 * Bundle contract (matches the tsdown client preset output):
 *   window.__ModuleLoader__.load({ id, factory(require) => module.exports })
 */
window.__ModuleLoader__.load({
  id: '@dsh-user/turn-rail',
  factory: (require) => {
    'use strict'
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var react = require('react')

    var CSS = `
      .tr-nav {
        position: fixed;
        top: 50%;
        bottom: 50%;
        right: 16px;
        transform: translateY(-50%);
        width: 34px;
        height: 300px;
        z-index: 900;
        border-radius: 8px;
        display: flex;
        align-items: center;
        user-select: none;
        transition: all .2s;
        --tr-page-padding: 15px 0 15px 24px;
      }
      .tr-bg {
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
        z-index: -1;
        background-color: rgba(255,255,255,.8);
        border-radius: 16px;
        width: 34px;
        height: calc(100% - 8px);
        max-height: calc(100% - 8px);
        position: absolute;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
      }
      @media (prefers-color-scheme: dark) {
        .tr-bg { background-color: rgba(21,21,23,.6); }
      }
      .tr-wrapper {
        width: 34px;
        pointer-events: auto;
        border: 1px solid transparent;
        border-radius: 16px;
        flex-direction: column;
        align-items: stretch;
        max-width: 240px;
        max-height: 100%;
        transition: background .2s, box-shadow .2s, width .2s;
        display: flex;
        position: absolute;
        right: 0;
        overflow: hidden;
      }
      .tr-wrapper.tr-show {
        width: fit-content;
        pointer-events: auto;
        background: var(--dsw-alias-bg-layer-1, #fff);
        box-shadow: 0 8px 32px rgba(0,0,0,.16);
        border-color: var(--dsw-alias-border-l2, rgba(128,128,128,.3));
      }
      .tr-wrapper:before, .tr-wrapper:after {
        content: "";
        z-index: 2;
        pointer-events: none;
        opacity: 0;
        background: linear-gradient(#fff 20.19%, rgba(255,255,255,0) 100%);
        width: 100%;
        height: 32px;
        transition: opacity .2s;
        position: absolute;
        left: 0;
      }
      .tr-wrapper.tr-show:before, .tr-wrapper.tr-show:after { opacity: 1; transition: none; }
      .tr-wrapper:before { top: 0; }
      .tr-wrapper:after { bottom: 0; transform: rotate(180deg); }
      .tr-wrapper.tr-at-top:after, .tr-wrapper.tr-at-bottom:before,
      .tr-wrapper.tr-no-scroll:before, .tr-wrapper.tr-no-scroll:after { opacity: 0; }
      @media (prefers-color-scheme: dark) {
        .tr-wrapper:before, .tr-wrapper:after {
          background: linear-gradient(180deg, var(--dsw-alias-bg-layer-1, #151517) 20.19%, rgba(35,35,36,0) 100%);
        }
      }
      .tr-page {
        max-height: 250px;
        padding: var(--tr-page-padding);
        overscroll-behavior: contain;
        flex-direction: column;
        align-items: flex-end;
        display: flex;
        position: relative;
        overflow-y: auto;
        scrollbar-width: none;
      }
      .tr-page::-webkit-scrollbar { display: none; }
      .tr-item {
        cursor: pointer;
        height: 30px;
        color: var(--dsw-alias-label-secondary, #999);
        justify-content: flex-end;
        align-items: center;
        width: calc(100% - 6px);
        margin-right: 8px;
        line-height: 20px;
        display: flex;
        flex: none;
      }
      .tr-item:hover { color: var(--dsw-alias-label-primary, #222); }
      .tr-indicator {
        flex-shrink: 0;
        justify-content: center;
        align-items: center;
        width: 16px;
        height: 20px;
        display: flex;
      }
      .tr-line {
        background-color: #e5e7eb;
        border-radius: 4px;
        flex-shrink: 0;
        width: 8px;
        height: 2px;
        transition: background-color .2s, width .2s;
      }
      .tr-item:hover .tr-line { background-color: #9ca3af; }
      .tr-title {
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0;
        margin-right: 12px;
        transition: opacity .1s, color .2s;
        overflow: hidden;
        max-width: 160px;
      }
      .tr-wrapper.tr-show .tr-title { opacity: 1; }
      .tr-item:hover .tr-title { color: var(--dsw-alias-label-primary, #222); }
      .tr-item.tr-active .tr-title {
        color: #3b82f6;
        font-weight: 500;
        opacity: 1;
      }
      .tr-item.tr-active .tr-line {
        background-color: #3b82f6;
        width: 12px;
      }
      @media (prefers-color-scheme: dark) {
        .tr-line { background-color: #3f3f46; }
        .tr-item:hover .tr-line { background-color: #6b7280; }
      }
      .tr-tooltip {
        position: fixed;
        transform: translateY(-50%);
        right: 60px;
        max-width: 280px;
        background: var(--dsw-alias-bg-overlay, #fff);
        border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3));
        border-radius: 10px;
        padding: 9px 12px;
        box-shadow: 0 8px 28px rgba(0,0,0,.22);
        pointer-events: none;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tr-tooltip-time {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary, #888);
        flex: none;
      }
      .tr-tooltip-text {
        font-size: 12px;
        line-height: 1.5;
        color: var(--dsw-alias-label-primary, #222);
        white-space: pre-wrap;
        word-break: break-all;
        display: -webkit-box;
        -webkit-line-clamp: 5;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tr-flash { animation: tr-flash 1.4s ease-out; }
      @keyframes tr-flash {
        0% { box-shadow: 0 0 0 3px rgba(59,130,246,.5); }
        100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
      }
      /* Apple-style bar spinner (42px): 12 rounded bars radiating out,
         each with a staggered opacity phase → spinning sweep. Slides in
         from the conversation top (50px) and back out; shown while early
         turns auto-page in. */
      .tr-loader {
        position: fixed;
        z-index: 1200;
        width: 42px;
        height: 42px;
        pointer-events: none;
        transform: translateX(-50%);
        transition: transform .28s ease, opacity .28s ease;
      }
      .tr-loader i {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 3px;
        height: 9px;
        margin: -4.5px 0 0 -1.5px;
        border-radius: 1.5px;
        background: #5f6a7d;
        opacity: .3;
        animation: tr-dot 1s linear infinite;
      }
      @keyframes tr-dot {
        0% { opacity: 1; }
        50% { opacity: .3; }
        100% { opacity: 1; }
      }
    `

    var extractText = function (content) {
      if (!Array.isArray(content)) return ''
      var parts = []
      for (var i = 0; i < content.length; i += 1) {
        var block = content[i]
        if (block !== null && typeof block === 'object' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim()
    }

    var pad = function (n) { return String(n).padStart(2, '0') }

    var fmtTime = function (t) {
      if (typeof t !== 'number' || !Number.isFinite(t)) return ''
      var d = new Date(t)
      var now = new Date()
      var hhmm = pad(d.getHours()) + ':' + pad(d.getMinutes())
      var sameDay = d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate()
      return sameDay ? hhmm : pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + hhmm
    }

    var escapeAttr = function (s) {
      return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }

    var throttle = function (fn, ms) {
      var last = 0
      return function () {
        var now = Date.now()
        if (now - last >= ms) {
          last = now
          fn()
        }
      }
    }

    var apply = function (ctx) {
      var slots = ctx.get('slots')
      if (slots === undefined) return

      var styleTag = document.createElement('style')
      styleTag.dataset.dyn = 'turn-rail'
      styleTag.textContent = CSS
      document.head.append(styleTag)
      ctx.effect(function () {
        return function () {
          styleTag.remove()
        }
      })

      function Rail(props) {
        var useSession = props.useSession
        var useProjection = props.useProjection
        var sessionId = props.sessionId
        var order = useSession(function (s) { return s.chat.order })
        var nodes = useSession(function (s) { return s.chat.nodes })
        var history = useProjection('turn-rail-history')
        var showState = react.useState(false)
        var show = showState[0]
        var setShow = showState[1]
        var showRef = react.useRef(false)
        showRef.current = show
        var activeState = react.useState(null)
        var active = activeState[0]
        var setActive = activeState[1]
        var loaderState = react.useState('idle')
        var loader = loaderState[0]
        var setLoader = loaderState[1]
        var loaderPosState = react.useState(null)
        var loaderPos = loaderPosState[0]
        var setLoaderPos = loaderPosState[1]
        var tipState = react.useState(null)
        var tip = tipState[0]
        var setTip = tipState[1]
        var edgeState = react.useState('no-scroll')
        var edge = edgeState[0]
        var setEdge = edgeState[1]
        var pageRef = react.useRef(null)
        var navUserScrollRef = react.useRef(0)
        var pendingNavScrollRef = react.useRef(false)
        var aliveRef = react.useRef(true)

        react.useEffect(function () {
          aliveRef.current = true
          return function () {
            aliveRef.current = false
          }
        }, [])

        // Window-scoped live user nodes: key + seq + text.
        var windowEntries = []
        var seqToKey = new Map()
        var keyToSeq = new Map()
        for (var i = 0; i < order.length; i += 1) {
          var key = order[i]
          var node = nodes.get(key)
          if (node === undefined || node.kind !== 'user') continue
          var data = node.data
          var seq = data !== null && typeof data === 'object' && typeof data.seq === 'number' ? data.seq : 0
          if (seq === 0) continue
          windowEntries.push({
            key: key,
            seq: seq,
            time: data !== null && typeof data === 'object' && typeof data.time === 'number' ? data.time : 0,
            text: extractText(data !== null && typeof data === 'object' ? data.content : undefined),
          })
          seqToKey.set(seq, key)
          keyToSeq.set(key, seq)
        }

        var bySeq = new Map()
        if (Array.isArray(history)) {
          for (var h = 0; h < history.length; h += 1) {
            var item = history[h]
            if (item === null || typeof item !== 'object') continue
            var hseq = typeof item.seq === 'number' ? item.seq : 0
            if (hseq === 0) continue
            bySeq.set(hseq, {
              seq: hseq,
              time: typeof item.time === 'number' ? item.time : 0,
              text: typeof item.text === 'string' ? item.text : '',
              key: seqToKey.get(hseq),
            })
          }
        }
        for (var w = 0; w < windowEntries.length; w += 1) {
          var we = windowEntries[w]
          if (!bySeq.has(we.seq)) bySeq.set(we.seq, we)
        }
        var entries = Array.from(bySeq.values()).sort(function (a, b) { return a.seq - b.seq })

        var seqToKeyRef = react.useRef(seqToKey)
        seqToKeyRef.current = seqToKey
        var keyToSeqRef = react.useRef(keyToSeq)
        keyToSeqRef.current = keyToSeq

        var orderRef = react.useRef(order)
        orderRef.current = order
        var kindRef = react.useRef(null)
        kindRef.current = (function () {
          var m = new Map()
          for (var i = 0; i < order.length; i += 1) {
            var k = order[i]
            var n = nodes.get(k)
            m.set(k, n === undefined ? 'unknown' : n.kind)
          }
          return m
        })()

        // Scroll-spy: the user turn currently at the viewport center.
        // A throttled scroll listener + center-line walk-back — reliable at
        // the very top and bottom, keeps a turn highlighted while long
        // assistant replies fill the center.
        react.useEffect(function () {
          var scroller = document.querySelector('[data-conversation-scroll]')
          if (scroller === null) return
          var compute = function () {
            var portRect = scroller.getBoundingClientRect()
            if (portRect.height <= 0) return
            var center = scroller.scrollTop + portRect.height / 2
            var arr = orderRef.current
            var best = null
            for (var i = 0; i < arr.length; i += 1) {
              var key = arr[i]
              var seq = keyToSeqRef.current.get(key)
              if (seq === undefined) continue
              var row = document.querySelector('[data-chat-anchor-key="' + escapeAttr(key) + '"]')
              if (row === null) continue
              var top = row.getBoundingClientRect().top - portRect.top + scroller.scrollTop
              if (top <= center) best = seq
              else break
            }
            if (best !== null) setActive(best)
          }
          var throttled = throttle(compute, 100)
          compute()
          scroller.addEventListener('scroll', throttled, { passive: true })
          return function () {
            scroller.removeEventListener('scroll', throttled)
          }
        }, [order, sessionId])

        // Keep the active row visible inside the expanded panel.
        react.useEffect(function () {
          if (!show || active === null) return
          var list = pageRef.current
          if (list === null) return
          var target = list.querySelector('.tr-item.tr-active')
          if (target !== null) target.scrollIntoView({ block: 'nearest' })
        }, [show, active])

        // The nav strip's scroll window follows the ACTIVE turn (the message
        // at the viewport center), centering that turn's bar in the strip.
        // The user can also scroll the strip directly to browse ALL turns:
        // after they scroll the strip within 3s we pause following so they
        // can freely browse; the next conversation scroll resumes it. While
        // hovered (panel expanded) the user scrolls the panel freely too.
        var syncNav = function () {
          if (showRef.current) return
          if (Date.now() - navUserScrollRef.current < 3000) return
          var page = pageRef.current
          if (page === null) return
          var item = page.querySelector('.tr-item.tr-active')
          if (item === null) return
          var target = item.offsetTop - (page.clientHeight - 30) / 2
          target = Math.max(0, Math.min(target, page.scrollHeight - page.clientHeight))
          pendingNavScrollRef.current = true
          page.scrollTop = target
        }
        react.useEffect(function () {
          syncNav()
        }, [active, entries.length])

        if (entries.length === 0) return null

        var updateEdge = function () {
          var el = pageRef.current
          if (el === null) return
          var canTop = el.scrollTop > 2
          var canBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 2
          setEdge(canTop && canBottom ? 'both' : canTop ? 'top' : canBottom ? 'bottom' : 'no-scroll')
        }

        var flashRow = function (row) {
          var scroller = document.querySelector('[data-conversation-scroll]')
          // When the conversation is pinned to the bottom, nudge it just past
          // the chat's bottom-follow threshold first. A smooth scrollIntoView
          // starts with a tiny offset that the chat misreads as a programmatic
          // write and snaps back to the floor; leaving the bottom first makes
          // it read the jump as reader input so it sticks.
          if (scroller !== null) {
            var floor = scroller.scrollHeight - scroller.clientHeight
            if (floor - scroller.scrollTop < 24) {
              scroller.scrollTop = Math.max(0, scroller.scrollTop - 26)
            }
          }
          row.scrollIntoView({ behavior: 'smooth', block: 'start' })
          row.classList.add('tr-flash')
          setTimeout(function () {
            row.classList.remove('tr-flash')
          }, 1500)
        }

        var startLoader = function () {
          var scroller = document.querySelector('[data-conversation-scroll]')
          if (scroller !== null) {
            var r = scroller.getBoundingClientRect()
            setLoaderPos({ left: r.left + r.width / 2, top: r.top })
          }
          setLoader('entering')
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { setLoader('spinning') })
          })
        }
        var finishLoader = function () {
          setLoader('leaving')
          setTimeout(function () { setLoader('idle') }, 300)
        }

        var jump = function (entry) {
          setShow(false)
          setTip(null)
          if (entry.key !== undefined) {
            var row = document.querySelector('[data-chat-anchor-key="' + escapeAttr(entry.key) + '"]')
            if (row !== null && row instanceof HTMLElement) {
              flashRow(row)
              return
            }
          }
          // Target not loaded into the window yet: auto-page via the
          // chat's own "load older" button until the turn arrives.
          startLoader()
          var attempts = 0
          var timer = setInterval(function () {
            if (!aliveRef.current) {
              clearInterval(timer)
              finishLoader()
              return
            }
            attempts += 1
            var keyNow = seqToKeyRef.current.get(entry.seq)
            if (keyNow !== undefined) {
              var rowNow = document.querySelector('[data-chat-anchor-key="' + escapeAttr(keyNow) + '"]')
              if (rowNow !== null && rowNow instanceof HTMLElement) {
                clearInterval(timer)
                finishLoader()
                flashRow(rowNow)
                return
              }
            }
            if (attempts > 40) {
              clearInterval(timer)
              finishLoader()
              return
            }
            var flow = document.querySelector('[data-conversation-scroll] [data-chat-flow]')
            if (flow === null) return
            var btn = flow.querySelector('button')
            if (btn === null || btn.disabled) return
            btn.click()
          }, 300)
        }

        var openTip = function (entry) {
          setTip({ seq: entry.seq, time: entry.time, text: entry.text })
        }

        var wrapperClass = 'tr-wrapper'
          + (show ? ' tr-show' : '')
          + (edge === 'top' || edge === 'both' ? ' tr-at-top' : '')
          + (edge === 'bottom' || edge === 'both' ? ' tr-at-bottom' : '')
          + (edge === 'no-scroll' ? ' tr-no-scroll' : '')

        var nav = react.createElement('div', {
          className: 'tr-nav',
          onMouseEnter: function () { setShow(true) },
          onMouseLeave: function () { setShow(false); setTip(null); syncNav() },
        },
          react.createElement('div', { className: 'tr-bg' }),
          react.createElement('div', { className: wrapperClass },
            react.createElement('div', {
              className: 'tr-page',
              ref: function (el) { pageRef.current = el },
              onScroll: function () {
                if (pendingNavScrollRef.current) {
                  pendingNavScrollRef.current = false
                } else {
                  navUserScrollRef.current = Date.now()
                }
                updateEdge()
              },
            },
              entries.map(function (e) {
                var isActive = e.seq === active
                return react.createElement('div', {
                  key: String(e.seq),
                  className: 'tr-item' + (isActive ? ' tr-active' : ''),
                  onClick: function () { jump(e) },
                  onMouseEnter: function () { openTip(e) },
                  onMouseLeave: function () { setTip(null) },
                },
                  react.createElement('span', { className: 'tr-title' },
                    e.text || '（图片/附件消息）',
                  ),
                  react.createElement('span', { className: 'tr-indicator' },
                    react.createElement('span', { className: 'tr-line' }),
                  ),
                )
              }),
            ),
          ),
        )

        var tooltip = null
        if (tip !== null) {
          var hit = null
          for (var i = 0; i < entries.length; i += 1) {
            if (entries[i].seq === tip.seq) {
              hit = entries[i]
              break
            }
          }
          if (hit !== null) {
            tooltip = react.createElement('div', { className: 'tr-tooltip' },
              react.createElement('span', { className: 'tr-tooltip-time' }, fmtTime(hit.time)),
              react.createElement('span', { className: 'tr-tooltip-text' }, hit.text || '（图片/附件消息）'),
            )
          }
        }

        var loaderEl = null
        if (loader !== 'idle' && loaderPos !== null) {
          // Entering starts just above the conversation window top; spinning
          // sits 50px below it; leaving slides back to the conversation top
          // and fades out there — never rising into the title bar.
          var ty = loader === 'spinning' ? 0 : -50
          var op = loader === 'leaving' ? 0 : 1
          var bars = []
          for (var b = 0; b < 12; b += 1) {
            bars.push(react.createElement('i', {
              key: b,
              style: {
                transform: 'rotate(' + (b * 30) + 'deg) translateY(-14px)',
                animationDelay: (b * (1000 / 12) / 1000) + 's',
              },
            }))
          }
          loaderEl = react.createElement('div', {
            className: 'tr-loader',
            style: {
              top: loaderPos.top + 50,
              left: loaderPos.left,
              transform: 'translateX(-50%) translateY(' + ty + 'px)',
              opacity: op,
            },
          }, bars)
        }

        return react.createElement(react.Fragment, null, nav, tooltip, loaderEl)
      }

      slots.inject('conversation.input.dock', function () {
        return slots.register(
          { name: 'conversation.input.dock', id: 'turn-rail', order: 100, label: '对话轮次记录条' },
          function (props) {
            return react.createElement(Rail, {
              useSession: props.useSession,
              useProjection: props.useProjection,
              sessionId: props.sessionId,
            })
          },
        )
      })
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
