import React from "react";
import type { Message } from "./InboxSidebar";

interface MessageViewProps {
  message: Message | null;
}

const MessageView: React.FC<MessageViewProps> = ({ message }) => {
  // ── Empty state ──────────────────────────────────────
  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">No message selected</p>
          <p className="text-gray-400 text-sm mt-1">Click an inbox item or run the demo</p>
        </div>
      </div>
    );
  }

  // ── Message view ──────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Meta header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">From</span>
          <p className="text-sm font-medium text-gray-800 mt-0.5 break-all">{message.sender}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Subject</span>
          <p className="text-base font-bold text-gray-900 mt-0.5">{message.subject}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {message.body}
        </div>
      </div>
    </div>
  );
};

export default React.memo(MessageView);
