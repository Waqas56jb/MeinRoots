/**
 * Minimal markdown → HTML for the AI-generated CV versions.
 *
 * A full markdown library would be several times the size of everything it is
 * needed for here, which is headings, lists, bold and paragraphs. The input is
 * model output rather than our own copy, so it is escaped first and only then
 * given structure — the escaping is the part that matters, and doing it up
 * front means no later rule can reintroduce raw HTML.
 */

const escapeHtml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const inline = (text) =>
  escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')

export const renderMarkdown = (source) => {
  if (!source) return ''
  const lines = String(source).split(/\r?\n/)
  const html = []
  let listOpen = false

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>')
      listOpen = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) {
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      // Shifted down one level: the page already owns its <h1>, and a document
      // with two h1s is a real accessibility problem, not a style preference.
      const level = Math.min(heading[1].length + 1, 5)
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    if (bullet) {
      if (!listOpen) {
        html.push('<ul>')
        listOpen = true
      }
      html.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }

    if (/^\s*(-{3,}|_{3,})\s*$/.test(line)) {
      closeList()
      html.push('<hr />')
      continue
    }

    closeList()
    html.push(`<p>${inline(line)}</p>`)
  }

  closeList()
  return html.join('\n')
}
