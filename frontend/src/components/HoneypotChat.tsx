import React, { useRef, useEffect } from "react";
import type { HoneypotArtifact } from "../api";

interface HoneypotChatProps {
  conversation: Array<{ role: string; text: string }>;
  artifacts: HoneypotArtifact[];
  isStreaming: boolean;
  isComplete: boolean;
  onBack: () => void;
}

const HoneypotChat: React.FC<HoneypotChatProps> = ({
  conversation,
  artifacts,
  isStreaming,
  isComplete,
  onBack,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length, isComplete]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-3 gradient-danger border-b border-red-500/20">
        <div className="relative flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          {isStreaming && (
            <div className="absolute w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          )}
        </div>
        <div className="flex-1">
          <h2
            className="font-bold text-red-400 text-sm tracking-wide"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            HONEYPOT ACTIVE
          </h2>
          <p className="text-[10px] text-red-400/60 mt-0.5">
            {isComplete
              ? "Engagement complete · Intelligence harvested"
              : isStreaming
              ? "Live engagement in progress…"
              : "Initializing honeypot…"}
          </p>
        </div>
        <span className="text-[10px] text-red-500/50 font-mono font-medium px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
          AGENT 5
        </span>
        <button
          onClick={onBack}
          className="ml-2 text-[10px] font-semibold text-red-200 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full hover:bg-red-500/20 transition"
        >
          Back to analysis
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "rgba(10, 14, 26, 0.5)" }}>
        {conversation.map((msg, i) => {
          const isScammer = msg.role === "scammer";
          return (
            <div
              key={i}
              className={`flex ${isScammer ? "justify-start" : "justify-end"} message-enter`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            >
              <div className="flex flex-col max-w-[85%]">
                <span
                  className={`text-[10px] font-semibold mb-1 px-1 tracking-wider uppercase ${
                    isScammer ? "text-red-400/60" : "text-cyan-400/60 text-right"
                  }`}
                >
                  {isScammer ? "AI Agent" : "🛡 Honeypot"}
                </span>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-all ${
                    isScammer
                      ? "bg-red-500/10 border border-red-500/20 text-red-100 rounded-tl-sm"
                      : "bg-cyan-500/15 border border-cyan-500/20 text-cyan-100 rounded-tr-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator while streaming */}
        {isStreaming && !isComplete && (
          <div className="flex justify-start message-enter">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400/60 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-red-400/60 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-red-400/60 typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Artifacts Panel */}
      {artifacts.length > 0 && (
        <div
          className={`border-t border-red-500/30 p-4 fade-in ${
            isComplete ? "gradient-danger" : ""
          }`}
          style={{ background: isComplete ? undefined : "rgba(239, 68, 68, 0.05)" }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-base">🚨</span>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              {isComplete ? "Threat Intelligence Harvested" : "Artifacts Detected"}
            </span>
            <span className="text-[10px] text-red-400/50 ml-auto font-mono">
              {artifacts.length} item{artifacts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-1.5">
            {artifacts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs message-enter">
                <span className="text-red-400 mt-0.5 text-[10px]">◆</span>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/70">{a.type}</span>
                  <code className="text-red-300 font-mono break-all bg-red-500/10 rounded px-2 py-1 border border-red-500/15 text-[11px] max-w-full overflow-hidden">
                    {a.value}
                  </code>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Completion Status */}
      {isComplete && (
        <div className="px-4 py-3 border-t border-emerald-500/20 gradient-success fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-semibold text-emerald-400">
              Honeypot engagement complete
            </span>
          </div>
          <p className="text-[10px] text-emerald-400/60 mt-1 ml-6">
            {conversation.length} messages exchanged · {artifacts.length} artifact
            {artifacts.length !== 1 ? "s" : ""} collected
          </p>
        </div>
      )}
    </div>
  );
};

export default HoneypotChat;