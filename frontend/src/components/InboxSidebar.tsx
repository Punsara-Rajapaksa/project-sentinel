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
    <aside className="w-72 bg-gray-900 text-white flex flex-col border-r border-gray-700">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Inbox</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-500 text-sm">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Hit <span className="text-emerald-400 font-medium">Run Demo</span> to load messages
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedId === msg.id;
            return (
              <button
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={`w-full text-left px-5 py-3.5 border-b border-gray-800 transition-colors ${
                  isSelected
                    ? "bg-emerald-600/20 border-l-2 border-l-emerald-400"
                    : "hover:bg-gray-800 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isSelected ? "bg-emerald-400" : "bg-gray-600"
                  }`} />
                  <span className="font-medium text-sm truncate">{msg.sender}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate pl-4">{msg.subject}</p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default React.memo(InboxSidebar);
