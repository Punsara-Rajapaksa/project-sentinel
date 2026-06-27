import React, { useState, useEffect } from "react";

interface HoneypotChatProps {
  conversation: Array<{ role: string; text: string }>;
  artifacts: string[];
}

const HoneypotChat: React.FC<HoneypotChatProps> = ({ conversation, artifacts }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  // ── Reveal messages one by one every 500ms ───────────
  useEffect(() => {
    setVisibleCount(0);
    if (conversation.length === 0) return;

    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= conversation.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [conversation]);

  const allRevealed = visibleCount >= conversation.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-red-50 flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <h2 className="font-bold text-red-800 text-sm">Honeypot Active</h2>
        <span className="text-[10px] text-red-500 font-medium ml-auto">Agent 5</span>
      </div>

      {/* Chat log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {conversation.slice(0, visibleCount).map((msg, i) => {
          const isScammer = msg.role === "scammer";
          return (
            <div
              key={i}
              className={`flex ${isScammer ? "justify-start" : "justify-end"} transition-opacity duration-300`}
            >
              <div className="flex flex-col max-w-[85%]">
                <span className={`text-[10px] font-semibold mb-0.5 px-1 ${isScammer ? "text-gray-400" : "text-blue-500 text-right"}`}>
                  {isScammer ? "Scammer" : "Honeypot"}
                </span>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isScammer
                      ? "bg-white border border-gray-200 text-gray-700 rounded-tl-sm"
                      : "bg-blue-600 text-white rounded-tr-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator while messages are still revealing */}
        {!allRevealed && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Artifacts harvested */}
      {allRevealed && artifacts.length > 0 && (
        <div className="border-t-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🚨</span>
            <span className="text-sm font-bold text-red-800">Threat intelligence harvested:</span>
          </div>
          <ul className="space-y-1">
            {artifacts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-500 mt-0.5">•</span>
                <code className="text-red-700 font-mono break-all bg-red-100 rounded px-1.5 py-0.5">{a}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HoneypotChat;