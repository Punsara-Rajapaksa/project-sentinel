import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "./components/InboxSidebar";
import InboxSidebar from "./components/InboxSidebar";
import MessageView from "./components/MessageView";
import RiskPanel from "./components/RiskPanel";
import { analyzeMessage, streamAnalysis } from "./api";
import type { AnalysisResponse } from "./api";
import "./App.css";

// ── Demo Messages — mix of email and WhatsApp ─────
const DEMO_MESSAGES: Array<{
  sender: string; subject: string; body: string; type: "email" | "whatsapp";
}> = [
  {
    sender: "dr.silva@university.ac.lk",
    subject: "Week 12 Lecture Materials + Room Change",
    type: "email",
    body: "Hi everyone,\n\nJust a reminder that tomorrow's Software Engineering lecture will be held in Hall B (not Hall A) due to ongoing renovations.\n\nI've uploaded the Week 12 slides and the group project guidelines to the LMS. Please review them before class. Also, project proposals are due next Friday — let me know if your group needs an extension.\n\nBest,\nDr. Silva\nDepartment of Computer Science",
  },
  {
    sender: "Mom",
    subject: "",
    type: "whatsapp",
    body: "Hey sweetie are you coming home for dinner tonight? Dad is making his special rice and curry. Let me know so I can set an extra plate 😊\n\nAlso your aunt called, she wants to know if you can help her set up her new laptop this weekend",
  },
  {
    sender: "it-security@universlty.ac.lk",
    subject: "URGENT: Password Reset Required - Account Compromised",
    type: "email",
    body: "Dear Student,\n\nOur security systems have detected unauthorized access attempts on your university account. Your account has been temporarily suspended as a precautionary measure.\n\nTo restore full access, you must verify your identity within 24 hours by visiting the secure portal below:\n\nhttps://universlty-portal-verify.com/reset-password\n\nFailure to complete verification will result in permanent account suspension and loss of all academic records.\n\nPlease treat this as a matter of urgency.\n\nBest regards,\nIT Security Team\nUniversity of Colombo",
  },
  {
    sender: "events@techcorp.lk",
    subject: "Team Building Event - July 5th",
    type: "email",
    body: "Hi Team,\n\nWe're excited to announce our quarterly team building event!\n\nDate: Saturday, July 5th\nTime: 9:00 AM - 4:00 PM\nVenue: Beira Lake Adventure Park\n\nActivities include kayaking, team challenges, and a BBQ lunch. Please RSVP by June 30th using the form on the company intranet.\n\nTransportation will be provided from the main office at 8:30 AM.\n\nLooking forward to seeing everyone there!\n\nBest,\nHR Events Team",
  },
  {
    sender: "+94 77 123 4567",
    subject: "",
    type: "whatsapp",
    body: "Bro I'm in serious trouble right now. I got mugged near the Fort station and they took my wallet and everything. Phone is about to die too. Can you send me Rs. 15,000 to my other account? Account: 8029471653 at Commercial Bank. I'll explain everything when I see you. Please bro this is urgent I'm completely stranded here with nothing.",
  },
  {
    sender: "ceo@cornpany.lk",
    subject: "Confidential - Wire Transfer Needed Today",
    type: "email",
    body: "Hi,\n\nI'm reaching out because I need you to process an urgent wire transfer for a confidential acquisition we're closing today. I know this is unusual but the timeline is very tight and I can't do it from my end right now.\n\nAmount: $12,500 USD\nRecipient: Vertex Holdings Ltd\nBank: HSBC Hong Kong\nAccount: 801-234567-001\nSWIFT: HSBCHKHHHKH\n\nPlease process this immediately and confirm once done. Do not discuss this with anyone else — the deal is under NDA and we can't risk it leaking before close.\n\nThanks for handling this.\n\nRajitha Perera\nCEO, TechCorp Solutions",
  },
  {
    sender: "+94 11 234 5678",
    subject: "",
    type: "whatsapp",
    body: "Dear Customer, your Commercial Bank account has been flagged for suspicious activity. To prevent your account from being frozen, please verify your identity immediately by visiting:\n\nhttps://commercial-bank-verify.net/secure\n\nYour one-time verification code is: 847291\n\nDo NOT share this code with anyone. This verification must be completed within 2 hours.\n\n- Commercial Bank Security Division",
  },
  {
    sender: "Thivina",
    subject: "",
    type: "whatsapp",
    body: "Hey! Are we still meeting at the library tomorrow at 2 for the group project? Sevin said he might be late but Senith confirmed. I booked discussion room 3 on the second floor.\n\nAlso did you finish the literature review section? We need to merge everything by Thursday 😅",
  },
  {
    sender: "registrar@university.ac.lk",
    subject: "Exam Schedule Update - Please Review",
    type: "email",
    body: "Dear Student,\n\nPlease review the attached revised examination timetable for the upcoming semester. There have been a few minor room changes due to venue maintenance.\n\nIf you have any timetable clashes, reply to this message with your student ID and we will review the case.\n\nKind regards,\nOffice of the Registrar",
  },
  {
    sender: "Amin",
    subject: "",
    type: "whatsapp",
    body: "Hey, I left the notes with you after class right? Can you send me the PDF before 6pm? I need to revise a few sections before the quiz tomorrow.",
  },
  {
    sender: "hr@global-support.com",
    subject: "Action Required: Payroll Verification",
    type: "email",
    body: "Hello,\n\nWe are updating employee payroll records and need you to verify your banking details before Friday. Please open the secure form and confirm your account number.\n\nFailure to complete this step may delay salary processing.\n\nRegards,\nHR Services",
  },
  {
    sender: "+94 76 555 0199",
    subject: "",
    type: "whatsapp",
    body: "Hi, this is the delivery team. We missed you at the address. Please tap this link to reschedule your parcel: http://parcel-track-support.com/rebook",
  },
  {
    sender: "ceo.office@techcorp-support.co",
    subject: "Please Handle This Privately",
    type: "email",
    body: "I need you to help me process a confidential invoice today. It is sensitive and I don't want the rest of the team looped in yet. Reply as soon as you see this and I'll send the transfer details.",
  },
  {
    sender: "DeliveryBot",
    subject: "",
    type: "whatsapp",
    body: "Your package has been held at customs. Confirm your delivery address and pay the release fee using the secure link in our next message.",
  },
  {
    sender: "library@campus.lk",
    subject: "New Study Room Booking Confirmation",
    type: "email",
    body: "Hello,\n\nYour study room booking for tomorrow has been confirmed. The reservation is under your name from 2:00 PM to 4:00 PM.\n\nPlease arrive five minutes early so we can check you in.\n\nBest,\nCampus Library",
  },
];

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [honeypotActive, setHoneypotActive] = useState(false);
  const [, setAgentsComplete] = useState<Set<number>>(new Set());
  const [riskTiers, setRiskTiers] = useState<Map<string, string>>(new Map());
  const demoIndexRef = useRef(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisCache = useRef<Map<string, AnalysisResponse>>(new Map());

  const selectedMessage = messages.find((m) => m.id === selectedId) || null;

  const dismissIntro = () => {
    setIntroFading(true);
    setTimeout(() => setShowIntro(false), 600);
  };

  // ── Streaming Analysis ──
  const runStreamingAnalysis = useCallback(async (msgId: string, fullText: string) => {
    const cached = analysisCache.current.get(msgId);
    if (cached) {
      setAnalysis(cached);
      setAgentsComplete(new Set([1, 2, 3, 4]));
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setHoneypotActive(false);
    setAgentsComplete(new Set());

    await streamAnalysis(
      fullText,
      (agent, _label, data) => {
        setAnalysis((prev) => ({ ...(prev || {} as AnalysisResponse), ...data }));
        setAgentsComplete((prev) => new Set([...prev, agent]));
      },
      (fullResult) => {
        setAnalysis(fullResult);
        setAgentsComplete(new Set([1, 2, 3, 4]));
        analysisCache.current.set(msgId, fullResult);
        setLoading(false);
        // Update risk tier for sidebar
        if (fullResult.risk_tier) {
          setRiskTiers((prev) => new Map(prev).set(msgId, fullResult.risk_tier));
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAnalysis(null);
      setError(null);
      setLoading(false);
      setHoneypotActive(false);
      setAgentsComplete(new Set());
      return;
    }
    const msg = messages.find((m) => m.id === selectedId);
    if (!msg) return;
    // Reset honeypot when switching messages
    setHoneypotActive(false);
    runStreamingAnalysis(msg.id, msg.fullText);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo ──
  const addDemoMessage = useCallback(() => {
    if (demoIndexRef.current >= DEMO_MESSAGES.length) {
      setDemoRunning(false);
      return;
    }
    const dm = DEMO_MESSAGES[demoIndexRef.current];
    const isWhatsApp = dm.type === "whatsapp";
    const msg: Message = {
      id: `demo-${demoIndexRef.current}`,
      sender: dm.sender,
      subject: dm.subject,
      body: dm.body,
      fullText: isWhatsApp
        ? `From: ${dm.sender}\nBody: ${dm.body}`
        : `From: ${dm.sender}\nSubject: ${dm.subject}\nBody: ${dm.body}`,
      type: dm.type,
    };
    demoIndexRef.current += 1;
    setMessages((prev) => {
      const updated = [...prev, msg];
      if (updated.length === 1) setSelectedId(msg.id);
      return updated;
    });
    // Pre-fetch analysis for sidebar risk indicators
    if (!analysisCache.current.has(msg.id)) {
      analyzeMessage(msg.fullText).then((result) => {
        analysisCache.current.set(msg.id, result);
        if (result.risk_tier) {
          setRiskTiers((prev) => new Map(prev).set(msg.id, result.risk_tier));
        }
      }).catch(() => {});
    }
  }, []);

  const startDemo = useCallback(() => {
    if (demoRunning) return;
    setDemoRunning(true);
    setHoneypotActive(false);
    demoIndexRef.current = 0;
    setMessages([]);
    setRiskTiers(new Map());
    analysisCache.current.clear();
    // Add first message immediately, then stagger
    addDemoMessage();
    demoIntervalRef.current = setInterval(addDemoMessage, 3500);
  }, [demoRunning, addDemoMessage]);

  useEffect(() => () => {
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
  }, []);

  const handleConfirmThreat = () => console.log("Threat confirmed:", analysis?.request_id);
  const handleFalsePositive = () => console.log("False positive:", analysis?.request_id);

  // ── Intro Screen ──
  if (showIntro) {
    return (
      <div className={`intro-screen ${introFading ? "fade-out" : ""}`}>
        <div className="intro-grid" />
        <div className="relative z-10 text-center">
          <div className="intro-logo mb-6">
            <svg className="w-20 h-20 mx-auto text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
            SENTINEL
          </h1>
          <p className="text-sm text-slate-400 mb-1 tracking-widest uppercase font-medium">
            AI-Powered Social Engineering Defense
          </p>
          <p className="text-xs text-slate-600 mb-10">
            Five-Agent Threat Analysis Pipeline
          </p>
          <button
            onClick={dismissIntro}
            className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 transition-all duration-300 shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50 active:scale-[0.97]"
          >
            Begin Monitoring
          </button>
          <p className="text-[10px] text-slate-600 mt-8 tracking-wider">
            AURORA 2026 · Team Four Loop
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "#0a0e1a" }}>
      {/* ════════ Header ════════ */}
      <header className="gradient-header px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">Sentinel</h1>
            <p className="text-[9px] text-slate-500 leading-tight font-medium tracking-wider uppercase">AURORA 2026 · Four Loop</p>
          </div>
        </div>

        <button
          onClick={startDemo}
          disabled={demoRunning}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${
            demoRunning
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-md shadow-cyan-900/20 active:scale-[0.97]"
          }`}
        >
          {demoRunning ? (
            <>
              <div className="w-3 h-3 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Launch Demo
            </>
          )}
        </button>
      </header>

      {/* ════════ Main Layout ════════ */}
      <div className="flex flex-1 overflow-hidden">
        <InboxSidebar
          messages={messages}
          selectedId={selectedId}
          onSelectMessage={setSelectedId}
          riskTiers={riskTiers}
        />
        <MessageView message={selectedMessage} />
        <div
          className="w-[400px] flex flex-col border-l"
          style={{ background: "rgba(15,23,42,0.5)", borderColor: "rgba(148,163,184,0.08)" }}
        >
          <div className="px-5 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "rgba(148,163,184,0.08)" }}>
            <h2 className="font-bold text-xs text-slate-300 tracking-wider uppercase">
              {honeypotActive ? "Honeypot Engagement" : "Threat Analysis"}
            </h2>
            {analysis && !honeypotActive && (
              <span className="text-[9px] text-slate-600 font-mono">{analysis.request_id?.slice(0, 8)}</span>
            )}
          </div>
          <RiskPanel
            analysis={analysis}
            loading={loading}
            error={error}
            onConfirmThreat={handleConfirmThreat}
            onFalsePositive={handleFalsePositive}
            onHoneypotActive={setHoneypotActive}
            onBackToAnalysis={() => setHoneypotActive(false)}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
