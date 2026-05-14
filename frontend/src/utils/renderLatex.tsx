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

  // If no $/$$ delimiters found but contains LaTeX commands, auto-wrap
  if (!s.includes('$')) {
    const latexPattern = /\\(?:frac|int|sum|cos|sin|tan|lim|log|ln|sqrt|pi|infty|alpha|beta|gamma|theta|partial|rightarrow|leftrightarrow|to|mapsto|cancel|underline|overline|vec|tilde|hat|dot|ddot|text|mbox|mathrm|mathbf|mathit|boxed|begin|end|[a-zA-Z]+)/;
    if (latexPattern.test(s)) {
      s = '$' + s + '$';
    }
  }

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

const CN_KEY_MAP: Record<string, string> = {
  '分析': 'analysis',
  '解题步骤': 'solution_steps',
  '学习建议': 'suggestion',
  '建议': 'suggestion',
  '巩固练习': 'similar_question',
  '相似题': 'similar_question',
  '错因类型': 'error_type',
  '错误类型': 'error_type',
}

export function extractJsonFromText(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed && typeof parsed === 'object') {
        // Map Chinese keys to English
        const mapped: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(parsed)) {
          mapped[CN_KEY_MAP[k] || k] = v
        }
        return mapped
      }
      return parsed
    } catch {
      return null
    }
  }
  return null
}
