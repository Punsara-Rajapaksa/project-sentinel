import React from "react";
import { useEffect, useState } from "react";

export interface Message {
  id: string;
  sender: string;
  subject: string;
  body: string;
  fullText: string;
  type: "email" | "whatsapp";
}

interface InboxSidebarProps {
  messages: Message[];
  selectedId: string | null;
  onSelectMessage: (id: string) => void;
  riskTiers: Map<string, string>;
  analyzingIds: Set<string>;
  confirmedMessageIds: Set<string>;
  honeypotSessions: Map<string, any>;
}

const InboxSidebar: React.FC<InboxSidebarProps> = ({
  messages,
  selectedId,
  onSelectMessage,
  riskTiers,
  analyzingIds,
  confirmedMessageIds,
  honeypotSessions,
}) => {
  const [flashingHighIds, setFlashingHighIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const highIds = messages
      .filter((msg) => riskTiers.get(msg.id) === "High")
      .map((msg) => msg.id);

    if (highIds.length === 0) return;

    setFlashingHighIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      highIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
          window.setTimeout(() => {
            setFlashingHighIds((current) => {
              const updated = new Set(current);
              updated.delete(id);
              return updated;
            });
          }, 220);
        }
      });
      return changed ? next : prev;
    });
  }, [messages, riskTiers]);

  const WarningIcon = () => (
    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h18.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );

  return (
    <aside
      className="w-72 flex flex-col border-r"
      style={{
        background: "linear-gradient(180deg, #0c1220 0%, #0a0e1a 100%)",
        borderColor: "rgba(148, 163, 184, 0.08)",
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(148, 163, 184, 0.08)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Inbox
          </h2>
          <span className="text-[10px] font-mono text-cyan-400/60 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/15">
            {messages.length}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              Hit{" "}
              <span className="text-cyan-400 font-semibold">Run Demo</span>
              <br />
              to load messages
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedId === msg.id;
            const tier = riskTiers.get(msg.id);
            const isHigh = tier === "High";
            const flashing = flashingHighIds.has(msg.id);
            return (
              <button
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={`w-full text-left px-5 py-3.5 border-b transition-all duration-200 ${
                  isSelected
                    ? "border-l-2 border-l-cyan-400"
                    : "border-l-2 border-l-transparent hover:border-l-slate-600"
                } ${isHigh ? "transition-shadow" : ""}`}
                style={{
                  borderBottomColor: "rgba(148, 163, 184, 0.05)",
                  background: isSelected
                    ? "rgba(6, 182, 212, 0.08)"
                    : "transparent",
                }}
              >
                <div
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 -my-1 ${
                    isHigh && flashing ? "bg-red-500/20 ring-1 ring-red-400/40" : isHigh ? "bg-red-500/10" : ""
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isSelected ? "bg-cyan-400" : "bg-slate-700"}`}
                  />
                  <span className="font-medium text-sm text-slate-200 truncate">
                    {msg.sender}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {honeypotSessions.has(msg.id) && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        {honeypotSessions.get(msg.id)?.isStreaming && (
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                        )}
                        HONEYPOT
                      </span>
                    )}
                    {confirmedMessageIds.has(msg.id) && !honeypotSessions.has(msg.id) && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                        CONFIRMED
                      </span>
                    )}
                    {/* Real-time analyzing spinner */}
                    {analyzingIds.has(msg.id) && !tier && (
                      <div className="w-3.5 h-3.5 border-[1.5px] border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
                    )}
                    {/* Risk tier badges after analysis completes */}
                    {tier === "High" && !confirmedMessageIds.has(msg.id) && !honeypotSessions.has(msg.id) && <WarningIcon />}
                    {tier === "Medium" && !confirmedMessageIds.has(msg.id) && !honeypotSessions.has(msg.id) && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                    {tier === "Low" && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate pl-4">
                  {msg.subject}
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default React.memo(InboxSidebar);
