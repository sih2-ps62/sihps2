import { useState } from 'react'
import { api } from '../services/api'

const SUGGESTIONS = [
  'What are the top risks?',
  'Which cargo needs attention?',
  "Where's the overdue personnel?",
  'Any open emergencies?',
]

export default function Assistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)

  const ask = async (question) => {
    if (!question.trim() || asking) return
    setAsking(true)
    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    try {
      const res = await api.askAssistant(question)
      setMessages((m) => [...m, { role: 'assistant', text: res.answer }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${err.message}` }])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="bg-base-900 border border-base-700 rounded-xl p-4 flex flex-col h-full max-h-[500px]">
      <h2 className="text-sm font-medium text-slate-300 mb-1">Command Assistant</h2>
      <p className="text-[11px] text-slate-500 mb-3">Grounded in live data — never a model guess.</p>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[120px]">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-xs px-2 py-1 rounded-md bg-base-800 hover:bg-base-700 text-slate-400 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg px-3 py-2 whitespace-pre-line ${
              m.role === 'user'
                ? 'bg-accent-500/15 text-accent-200 ml-6'
                : 'bg-base-800 text-slate-300 mr-2'
            }`}
          >
            {m.text}
          </div>
        ))}
        {asking && <div className="text-xs text-slate-500 px-1">thinking…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about live operations…"
          className="flex-1 bg-base-800 border border-base-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={asking}
          className="px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm transition-colors"
        >
          Ask
        </button>
      </form>
    </div>
  )
}
