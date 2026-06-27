import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "./components/InboxSidebar";
import InboxSidebar from "./components/InboxSidebar";
import MessageView from "./components/MessageView";
import RiskPanel from "./components/RiskPanel";
import { analyzeMessage } from "./api";
import type { AnalysisResponse } from "./api";
import "./App.css";

// ── Demo Messages ─────────────────────────────────
const DEMO_MESSAGES = [
  {
    sender: "lecturer@university.ac.lk",
    subject: "Tomorrow's lecture room change",
    body: "Hi everyone, just a reminder that tomorrow's lecture will be held in Hall B instead of Hall A. See you there.",
  },
  {
    sender: "support@secuirty-alert.com",
    subject: "Urgent: Your account has been suspended!",
    body: "Dear user, we detected unusual activity. Verify your account immediately by clicking the link below, otherwise your access will be permanently disabled.",
  },
  {
    sender: "bestfriend@gmail.com",
    subject: "Emergency bro",
    body: "Bro I need you to send me $500 right now. My wallet got stolen and I'm stuck. I'll explain later just please do it quickly.",
  },
];

/* Agent pipeline stages */
const PIPELINE = [
  { id: 1, label: "Ingestion" },
  { id: 2, label: "Semantic Risk" },
  { id: 3, label: "OSINT Verify" },
  { id: 4, label: "Explainer" },
  { id: 5, label: "Honeypot" },
];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [honeypotActive, setHoneypotActive] = useState(false);
  const demoIndexRef = useRef(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Analysis cache ──
  const analysisCache = useRef<Map<string, AnalysisResponse>>(new Map());
  const selectedMessage = messages.find((m) => m.id === selectedId) || null;

  // ── Run Analysis ──
  const runAnalysis = useCallback(async (msgId: string, fullText: string) => {
    const cached = analysisCache.current.get(msgId);
    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setHoneypotActive(false);
    try {
      const result = await analyzeMessage(fullText);
      analysisCache.current.set(msgId, result);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAnalysis(null);
      setError(null);
      setLoading(false);
      setHoneypotActive(false);
      return;
    }
    const msg = messages.find((m) => m.id === selectedId);
    if (!msg) return;
    runAnalysis(msg.id, msg.fullText);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo ──
  const addDemoMessage = useCallback(() => {
    if (demoIndexRef.current >= DEMO_MESSAGES.length) {
      setDemoRunning(false);
      return;
    }
    const dm = DEMO_MESSAGES[demoIndexRef.current];
    const msg: Message = {
      id: `demo-${demoIndexRef.current}`,
      sender: dm.sender,
      subject: dm.subject,
      body: dm.body,
      fullText: `From: ${dm.sender}\nSubject: ${dm.subject}\nBody: ${dm.body}`,
    };
    demoIndexRef.current += 1;
    setMessages((prev) => {
      const updated = [...prev, msg];
      if (updated.length === 1) setSelectedId(msg.id);
      return updated;
    });
    if (!analysisCache.current.has(msg.id)) {
      analyzeMessage(msg.fullText).then((result) => {
        analysisCache.current.set(msg.id, result);
      }).catch(() => {});
    }
  }, []);

  const startDemo = useCallback(() => {
    if (demoRunning) return;
    setDemoRunning(true);
    setHoneypotActive(false);
    demoIndexRef.current = 0;
    setMessages([]);
    analysisCache.current.clear();
    addDemoMessage();
    demoIntervalRef.current = setInterval(addDemoMessage, 6000);
  }, [demoRunning, addDemoMessage]);

  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);

  // ── Handlers ──
  const handleConfirmThreat = () => console.log("Threat confirmed:", analysis?.request_id);
  const handleFalsePositive = () => console.log("False positive:", analysis?.request_id);
  const handleDismiss = () => console.log("Dismissed");

  return (
    <div className="h-screen flex flex-col" style={{ background: "#0a0e1a" }}>
      {/* ════════ Top Header ════════ */}
      <header className="gradient-header px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Shield Icon */}
          <div className="relative">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
              SudoShield
            </h1>
            <p className="text-[10px] text-slate-500 leading-tight font-medium tracking-wide">
              AURORA 2026 · Team Four Loop
            </p>
          </div>
        </div>

        {/* Agent Pipeline */}
        <nav className="flex items-center gap-0 text-xs">
          {PIPELINE.map((p, i) => {
            const isActive = p.id <= 4 || (p.id === 5 && honeypotActive);
            const isCurrent = p.id === 5 && honeypotActive;
            return (
              <div key={p.id} className="flex items-center">
                <div
                  className={`pipeline-node px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 ${
                    isCurrent
                      ? "bg-red-500/20 text-red-400 border border-red-500/40 glow-red"
                      : isActive
                      ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/25"
                      : "bg-slate-800/50 text-slate-600 border border-slate-700/50"
                  }`}
                >
                  {p.id}. {p.label}
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className={`w-5 h-px mx-0.5 transition-colors duration-300 ${
                    isActive && (PIPELINE[i + 1]?.id <= 4 || (PIPELINE[i + 1]?.id === 5 && honeypotActive))
                      ? "bg-cyan-500/30"
                      : "bg-slate-700/50"
                  }`} />
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={startDemo}
          disabled={demoRunning}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
            demoRunning
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-900/25 hover:shadow-cyan-900/40 active:scale-[0.97]"
          }`}
        >
          {demoRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
              Demo Running…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Run Demo
            </>
          )}
        </button>
      </header>

      {/* ════════ Main 3-Column Layout ════════ */}
      <div className="flex flex-1 overflow-hidden">
        <InboxSidebar messages={messages} selectedId={selectedId} onSelectMessage={setSelectedId} />
        <MessageView message={selectedMessage} />
        <div
          className="w-[400px] flex flex-col border-l"
          style={{
            background: "rgba(15, 23, 42, 0.5)",
            borderColor: "rgba(148, 163, 184, 0.08)",
          }}
        >
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(148, 163, 184, 0.08)" }}>
            <h2 className="font-bold text-sm text-slate-200 tracking-wide">
              {honeypotActive ? "🎯 Honeypot" : "🛡 Risk Analysis"}
            </h2>
            {analysis && !honeypotActive && (
              <span className="text-[10px] text-slate-500 font-mono">{analysis.request_id?.slice(0, 8)}…</span>
            )}
          </div>
          <RiskPanel
            analysis={analysis}
            loading={loading}
            error={error}
            onConfirmThreat={handleConfirmThreat}
            onFalsePositive={handleFalsePositive}
            onDismiss={handleDismiss}
            onHoneypotActive={setHoneypotActive}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
