/**
 * Notices when the deployed build has moved on, and reloads.
 *
 * A single-page app fetches index.html once. Every navigation after that is
 * JavaScript, so a tab left open across a deploy keeps running the old build
 * indefinitely — the server can be entirely correct and the person looking at
 * it still sees last week's screen. That is not a theoretical problem: it cost
 * two rounds of "this is not fixed" on a change that had in fact shipped, with
 * screenshots of a dialog that no longer existed.
 *
 * The check is deliberately cheap. index.html is served no-cache, so asking for
 * it is one conditional request that usually answers 304, and the asset hash
 * inside it changes on every build. Comparing that hash to the one this bundle
 * was built with is enough to know the tab is stale.
 *
 * It waits for the tab to be visible before acting, so a background tab does
 * not reload under someone working in another window, and it refuses to reload
 * over unsaved typing. A stale build is annoying; a reload that eats a
 * half-written questionnaire answer is worse than the problem it solves.
 */

const POLL_MS = 5 * 60 * 1000

/**
 * Is there work on screen that a reload would destroy?
 *
 * Any non-empty text field counts, and so does having one focused. Both are
 * blunt, and both fail in the safe direction: the worst case is that a stale
 * tab waits a few more minutes, until the person stops typing.
 */
const hasUnsavedInput = () => {
  const active = document.activeElement
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true
  return [...document.querySelectorAll('input, textarea')].some((el) => {
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') return false
    if (el.type === 'search') return false // a filter box is not unsaved work
    return String(el.value ?? '').trim().length > 0
  })
}

/** The asset filename this build shipped with, read out of the loaded scripts. */
const currentBuild = () => {
  const src = [...document.querySelectorAll('script[src]')]
    .map((s) => s.getAttribute('src'))
    .find((s) => s && /assets\/index-[A-Za-z0-9_-]+\.js/.test(s))
  return src ? src.match(/assets\/index-[A-Za-z0-9_-]+\.js/)[0] : null
}

const deployedBuild = async () => {
  // cache: 'no-store' rather than trusting the header: some mobile browsers
  // serve a memory copy for same-URL fetches and would answer with the very
  // document we are trying to look past.
  const res = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!res.ok) return null
  const html = await res.text()
  const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
  return m ? m[0] : null
}

export const watchForNewBuild = () => {
  const mine = currentBuild()
  // In dev there is no hashed bundle, and nothing to compare.
  if (!mine) return () => {}

  let stopped = false

  const check = async () => {
    if (stopped || document.visibilityState !== 'visible') return
    if (hasUnsavedInput()) return
    try {
      const live = await deployedBuild()
      // Checked twice: the fetch is a round trip, and someone can start typing
      // during it.
      if (live && live !== mine && !hasUnsavedInput()) {
        stopped = true
        // replace(), not reload(): the entry this tab is on may itself be a
        // route the new build no longer has.
        window.location.replace(window.location.href)
      }
    } catch {
      // Offline, or the server is restarting mid-deploy. Try again next tick;
      // a failed version check must never be visible to the operator.
    }
  }

  const timer = setInterval(check, POLL_MS)
  // Coming back to the tab is the moment a stale build is most likely and most
  // worth catching, so it is checked then as well as on the timer.
  document.addEventListener('visibilitychange', check)
  check()

  return () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', check)
  }
}
