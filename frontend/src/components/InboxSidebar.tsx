import React from "react";

export interface Message {
  id: string;
  sender: string;
  subject: string;
  body: string;
  fullText: string;
}

interface InboxSidebarProps {
  messages: Message[];
  selectedId: string | null;
  onSelectMessage: (id: string) => void;
}

const InboxSidebar: React.FC<InboxSidebarProps> = ({
  messages,
  selectedId,
  onSelectMessage,
}) => {
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
            return (
              <button
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={`w-full text-left px-5 py-3.5 border-b transition-all duration-200 ${
                  isSelected
                    ? "border-l-2 border-l-cyan-400"
                    : "border-l-2 border-l-transparent hover:border-l-slate-600"
                }`}
                style={{
                  borderBottomColor: "rgba(148, 163, 184, 0.05)",
                  background: isSelected
                    ? "rgba(6, 182, 212, 0.08)"
                    : "transparent",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                      isSelected ? "bg-cyan-400" : "bg-slate-700"
                    }`}
                  />
                  <span className="font-medium text-sm text-slate-200 truncate">
                    {msg.sender}
                  </span>
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
