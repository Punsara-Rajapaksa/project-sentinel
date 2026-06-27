import React from "react";
import type { Message } from "./InboxSidebar";

interface MessageViewProps {
  message: Message | null;
}

const MessageView: React.FC<MessageViewProps> = ({ message }) => {
  // ── Empty state ──
  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#0d1117" }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-slate-600"
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
          <p className="text-slate-400 font-medium text-sm">No message selected</p>
          <p className="text-slate-600 text-xs mt-1">
            Click an inbox item or run the demo
          </p>
        </div>
      </div>
    );
  }

  // ── Message view ──
  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ background: "#0d1117" }}>
      {/* Meta header */}
      <div
        className="border-b px-6 py-4"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          borderColor: "rgba(148, 163, 184, 0.08)",
        }}
      >
        <div className="mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
            From
          </span>
          <p className="text-sm font-medium text-slate-200 mt-0.5 break-all font-mono">
            {message.sender}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Subject
          </span>
          <p className="text-base font-bold text-white mt-0.5">
            {message.subject}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div
          className="glass-card p-5 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"
        >
          {message.body}
        </div>
      </div>
    </div>
  );
};

export default React.memo(MessageView);
