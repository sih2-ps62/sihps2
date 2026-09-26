import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { api } from "../../lib/api";

const SUGGESTIONS = [
  "Which stations have low stock right now?",
  "Are any personnel overdue for check-in?",
  "What emergencies are currently open?",
];

export default function AssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsSending(true);

    try {
      const result = await api.post("/assistant/chat", { message: trimmed });
      setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open PolarOps Assistant"
        className="focus-ring fixed bottom-6 right-6 z-[1900] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-glass-hover transition-transform duration-200 hover:scale-105"
      >
        <Sparkles size={22} strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div className="animate-fade-slide-up fixed bottom-6 right-6 z-[1900] flex h-[520px] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface-solid shadow-glass-hover">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="icon-chip h-8 w-8">
            <Bot size={16} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">PolarOps Assistant</p>
            <p className="text-[11px] text-text-secondary">Answers grounded in live data</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close assistant"
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div ref={scrollRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-secondary">Try asking:</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="focus-ring rounded-xl border border-border bg-surface px-3 py-2 text-left text-xs text-text-primary transition-colors duration-150 hover:bg-accent-soft/50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-auto bg-accent text-white"
                : msg.role === "error"
                  ? "bg-status-critical/10 text-status-critical"
                  : "bg-accent-soft text-text-primary"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {isSending && <div className="w-fit rounded-xl bg-accent-soft px-3 py-2 text-sm text-text-secondary">Thinking…</div>}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about current operations…"
          className="focus-ring flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          aria-label="Send message"
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
