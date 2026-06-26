import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "./components/InboxSidebar";
import InboxSidebar from "./components/InboxSidebar";
import MessageView from "./components/MessageView";
import RiskPanel from "./components/RiskPanel";
import { analyzeMessage } from "./api";
import type { AnalysisResponse } from "./api";

// ── Demo Messages ─────────────────────────────────────
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

/* Agent pipeline stages shown at the top of the UI */
const PIPELINE = [
  { id: 1, label: "Ingestion", active: true },
  { id: 2, label: "Semantic Risk", active: true },
  { id: 3, label: "OSINT Verify", active: true },
  { id: 4, label: "Explainer", active: true },
  { id: 5, label: "Honeypot", active: false },
];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const demoIndexRef = useRef(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Analysis cache: avoid re-fetching the same message ──
  const analysisCache = useRef<Map<string, AnalysisResponse>>(new Map());

  const selectedMessage = messages.find((m) => m.id === selectedId) || null;

  // ── Analyse only when selectedId changes (NOT when messages array changes) ──
  const runAnalysis = useCallback(async (msgId: string, fullText: string) => {
    // Check cache first
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
      return;
    }

    const msg = messages.find((m) => m.id === selectedId);
    if (!msg) return;

    runAnalysis(msg.id, msg.fullText);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo: add a message ───────────────────────────────
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
      // Only auto-select the first message; after that, stay where the user is
      if (updated.length === 1) {
        setSelectedId(msg.id);
      }
      return updated;
    });
    // Eagerly pre-fetch analysis for this message in the background
    if (!analysisCache.current.has(msg.id)) {
      analyzeMessage(msg.fullText).then((result) => {
        analysisCache.current.set(msg.id, result);
      }).catch(() => { /* silently ignore pre-fetch errors */ });
    }
  }, []);

  const startDemo = useCallback(() => {
    if (demoRunning) return;
    setDemoRunning(true);
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

  // ── User action handlers ──────────────────────────────
  const handleConfirmThreat = () => console.log("Threat confirmed:", analysis?.request_id);
  const handleFalsePositive  = () => console.log("False positive:", analysis?.request_id);
  const handleDismiss        = () => console.log("Dismissed");

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ════════ Top Header ════════ */}
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Sentinel</h1>
            <p className="text-[10px] text-gray-400 leading-tight">AURORA 2026 · Team Four Loop</p>
          </div>
        </div>

        {/* Agent Pipeline */}
        <nav className="flex items-center gap-0 text-xs">
          {PIPELINE.map((p, i) => (
            <div key={p.id} className="flex items-center">
              <div
                className={`px-3 py-1.5 rounded font-medium transition-colors ${
                  p.active
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-gray-800 text-gray-500 border border-gray-700"
                }`}
              >
                {p.id}. {p.label}
              </div>
              {i < PIPELINE.length - 1 && (
                <div className={`w-5 h-px mx-0.5 ${p.active && PIPELINE[i + 1]?.active ? "bg-emerald-500/40" : "bg-gray-700"}`} />
              )}
            </div>
          ))}
        </nav>

        <button
          onClick={startDemo}
          disabled={demoRunning}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            demoRunning
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
          }`}
        >
          {demoRunning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Risk Analysis</h2>
            {analysis && (
              <span className="text-[10px] text-gray-400 font-mono">{analysis.request_id?.slice(0, 8)}…</span>
            )}
          </div>
          <RiskPanel
            analysis={analysis}
            loading={loading}
            error={error}
            onConfirmThreat={handleConfirmThreat}
            onFalsePositive={handleFalsePositive}
            onDismiss={handleDismiss}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
