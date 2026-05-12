import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import React from 'react'

const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false,
}

export function renderLatex(text: unknown): React.ReactNode[] {
  const raw = typeof text === 'string' ? text
    : Array.isArray(text) ? text.join('\n')
    : String(text || '')

  // Normalize delimiters: \(...\) → $...$  and  \[...\] → $$...$$
  let s = raw.replace(/\\\(/g, '$').replace(/\\\)/g, '$')
  s = s.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')

  const parts: React.ReactNode[] = []
  let key = 0

  // Split by $$...$$ first, then $...$, and render math segments with KaTeX.
  // Non-math segments are rendered as plain text.
  // Use a regex that matches both $$...$$ and $...$.
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/
  let remaining = s
  let match: RegExpExecArray | null

  while ((match = regex.exec(remaining)) !== null) {
    const fullMatch = match[0]
    const idx = match.index

    // Text before the match
    if (idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>)
    }

    // The math content (without the $ delimiters)
    if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
      const math = fullMatch.slice(2, -2)
      try {
        parts.push(<BlockMath key={key++} math={math} settings={KATEX_OPTIONS} />)
      } catch {
        parts.push(<span key={key++}>{fullMatch}</span>)
      }
    } else { // $...$
      const math = fullMatch.slice(1, -1)
      try {
        parts.push(<InlineMath key={key++} math={math} settings={KATEX_OPTIONS} />)
      } catch {
        parts.push(<span key={key++}>{fullMatch}</span>)
      }
    }

    remaining = remaining.slice(idx + fullMatch.length)
  }

  // Remaining text after the last match
  if (remaining.length > 0) {
    parts.push(<span key={key++}>{remaining}</span>)
  }

  return parts
}

export function extractJsonFromText(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }
  return null
}
