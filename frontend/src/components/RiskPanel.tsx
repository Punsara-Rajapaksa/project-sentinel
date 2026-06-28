import React, { useState } from "react";
import type { AnalysisResponse } from "../api";
import HoneypotChat from "./HoneypotChat";
import type { HoneypotSession } from "../App";

interface RiskPanelProps {
  analysis: AnalysisResponse | null;
  loading: boolean;
  error: string | null;
  isThreatConfirmed: boolean;
  honeypotSession: HoneypotSession | null;
  onConfirmThreat: () => void;
  onFalsePositive: () => void;
  onDeployHoneypot: () => void;
  onBackToAnalysis: () => void;
  honeypotActive: boolean;
}

// ── Color helpers ──
const TIER_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  High:   { bg: "bg-red-500/10",   text: "text-red-400",   border: "border-red-500/30",   glow: "glow-red" },
  Medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", glow: "" },
  Low:    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", glow: "glow-emerald" },
};

const REC_COLORS: Record<string, string> = {
  "Report & Archive":     "bg-red-500/10 text-red-400 border-red-500/25",
  "Do Not Engage":        "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "Proceed with Caution": "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
};

const safePct = (val: number | undefined | null): string => {
  if (val == null || Number.isNaN(val)) return "—";
  return `${Math.round(val * 100)}%`;
};
const safeNum = (val: number | undefined | null): number => {
  if (val == null || Number.isNaN(val)) return 0;
  return val;
};

// ── Agent Badge ──
const AgentBadge: React.FC<{ id: number; label: string }> = ({ id, label }) => (
  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-slate-800/50 rounded-full px-2.5 py-1 border border-slate-700/50">
    <span className="text-cyan-400 font-bold">A{id}</span> {label}
  </span>
);

// ── Danger Bar ──
const DangerBar: React.FC<{ pct: number }> = ({ pct }) => {
  const color = pct > 0.66 ? "bg-red-500" : pct > 0.33 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-1.5 overflow-hidden">
      <div
        className={`h-1.5 rounded-full bar-animated ${color}`}
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  );
};

const RiskPanel: React.FC<RiskPanelProps> = ({
  analysis,
  loading,
  error,
  isThreatConfirmed,
  honeypotSession,
  onConfirmThreat,
  onFalsePositive,
  onDeployHoneypot,
  onBackToAnalysis,
  honeypotActive,
}) => {
  const [showPii, setShowPii] = useState(false);
  const [showVerification, setShowVerification] = useState(true);

  const handleConfirmThreat = () => {
    if (!analysis) return;
    onConfirmThreat();
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Analyzing threat vectors…</p>
          <p className="text-[10px] text-slate-500 mt-1">Running agents 1 → 2 → 3 → 4</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="p-5">
        <div className="glass-card gradient-danger p-4 border-red-500/20">
          <h3 className="text-sm font-bold text-red-400 mb-1">Analysis Error</h3>
          <p className="text-sm text-red-300/80">{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty State ──
  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Select a message to view<br />threat analysis
          </p>
        </div>
      </div>
    );
  }

  // ── Honeypot Error ──
  if (honeypotSession?.error && honeypotActive) {
    return (
      <div className="p-5">
        <div className="glass-card gradient-danger p-4 border-red-500/20">
          <h3 className="text-sm font-bold text-red-400 mb-1">Honeypot Error</h3>
          <p className="text-sm text-red-300/80">{honeypotSession.error}</p>
          <button
            onClick={onBackToAnalysis}
            className="mt-3 w-full py-2 rounded-xl text-sm font-semibold text-red-200 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition"
          >
            Back to analysis
          </button>
        </div>
      </div>
    );
  }

  // ── Honeypot Active (streaming or complete) ──
  if (honeypotActive && honeypotSession) {
    return (
      <HoneypotChat
        conversation={honeypotSession.conversation}
        artifacts={honeypotSession.artifacts}
        isStreaming={honeypotSession.isStreaming}
        isComplete={honeypotSession.isComplete}
        onBack={onBackToAnalysis}
      />
    );
  }

  const tier = analysis.risk_tier || "Low";
  const tierColors = TIER_COLORS[tier] || TIER_COLORS.Low;
  const isThreat = tier === "High" || tier === "Medium";
  const rec = analysis.recommendation || "";
  const vd = analysis.verification_details;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 space-y-4">
        {/* ═══ Agent 4: Final Verdict ═══ */}
        <div className="fade-in">
          <div className="flex items-center gap-2 mb-2">
            <AgentBadge id={4} label="Explainer" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Final Verdict</span>
          </div>
          <div className={`glass-card p-4 space-y-3 ${tierColors.glow}`}>
            {/* Row 1: tier + score */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
                {tier} Risk
              </span>
              <div className="text-right">
                <span className="text-2xl font-bold text-slate-100">{safePct(analysis.composite_risk_score)}</span>
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Composite Score</div>
              </div>
            </div>
            {/* Row 2: recommendation */}
            {rec && (
              <div className={`px-3 py-2 rounded-lg border text-xs font-bold text-center ${REC_COLORS[rec] || "bg-slate-800 text-slate-400 border-slate-700"}`}>
                {rec}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Agent 2: Semantic Risk Scores ═══ */}
        <div className="fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-2">
            <AgentBadge id={2} label="Semantic" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Behavioral Analysis</span>
          </div>
          <div className="glass-card p-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Urgency Pressure</span>
                <span className="text-slate-200 font-semibold">{safePct(analysis.urgency_score)}</span>
              </div>
              <DangerBar pct={safeNum(analysis.urgency_score)} />
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Authority Manipulation</span>
                <span className="text-slate-200 font-semibold">{safePct(analysis.authority_manipulation_score)}</span>
              </div>
              <DangerBar pct={safeNum(analysis.authority_manipulation_score)} />
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Known-Scam Similarity</span>
                <span className="text-slate-200 font-semibold">{safePct(analysis.structural_similarity_score)}</span>
              </div>
              <DangerBar pct={safeNum(analysis.structural_similarity_score)} />
            </div>
          </div>
        </div>

        {/* ═══ Agent 3: Verification ═══ */}
        {vd && (
          <div className="fade-in" style={{ animationDelay: "0.15s" }}>
            <button onClick={() => setShowVerification(!showVerification)} className="w-full flex items-center gap-2 mb-2 text-left">
              <AgentBadge id={3} label="OSINT" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex-1">Technical Verification</span>
              <svg
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${showVerification ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showVerification && (
              <div className="glass-card p-4 space-y-2.5 text-xs">
                {/* Authenticity bar */}
                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sender Authenticity</span>
                    <span className={`font-semibold ${
                      safeNum(analysis.authenticity_confidence_score) < 0.4 ? "text-red-400" :
                      safeNum(analysis.authenticity_confidence_score) < 0.7 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {safePct(analysis.authenticity_confidence_score)}
                    </span>
                  </div>
                  <DangerBar pct={safeNum(analysis.authenticity_confidence_score)} />
                </div>
                <hr className="border-slate-700/50" />
                {vd.domain && (
                  <div className="flex justify-between"><span className="text-slate-400">Domain</span><span className="text-slate-200 font-mono text-[11px]">{vd.domain}</span></div>
                )}
                {vd.domain_age_days != null && (
                  <div className="flex justify-between"><span className="text-slate-400">Domain Age</span><span className={`font-semibold ${vd.domain_age_days < 90 ? "text-red-400" : "text-emerald-400"}`}>{vd.domain_age_days} days</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-400">SPF Record</span><span className={`font-semibold ${vd.spf_valid ? "text-emerald-400" : "text-red-400"}`}>{vd.spf_valid ? "✓ Valid" : "✗ Invalid"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">DKIM Record</span><span className={`font-semibold ${vd.dkim_valid ? "text-emerald-400" : "text-red-400"}`}>{vd.dkim_valid ? "✓ Valid" : "✗ Invalid"}</span></div>
                {vd.typosquatting_detected && (
                  <div className="flex justify-between"><span className="text-slate-400">Typosquatting</span><span className="text-red-400 font-semibold">⚠ Detected</span></div>
                )}
                {vd.malicious_urls && vd.malicious_urls.length > 0 && (
                  <div>
                    <span className="text-slate-400 block mb-1">Suspicious URLs</span>
                    {vd.malicious_urls.map((url, i) => (
                      <div key={i} className="text-red-400 font-mono truncate bg-red-500/10 rounded px-2 py-1 mt-1 text-[11px] border border-red-500/15">{url}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Agent 2: Assessment + Risk Factors ═══ */}
        <div className="fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="mb-2">
            <AgentBadge id={2} label="Semantic" />
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Assessment</h4>
              <p className="text-sm text-slate-300 leading-relaxed glass-card-light p-3">
                {analysis.risk_assessment || "No assessment available."}
              </p>
            </div>
            {analysis.risk_factors && analysis.risk_factors.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Risk Factors</h4>
                <ul className="space-y-1.5">
                  {analysis.risk_factors.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-amber-200/80 bg-amber-500/8 rounded-lg px-3 py-2 border border-amber-500/15">
                      <span className="text-amber-400 font-bold flex-shrink-0">⚠</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ═══ PII Privacy Toggle ═══ */}
        {analysis.is_anonymized && (
          <div className="fade-in" style={{ animationDelay: "0.3s" }}>
            <button onClick={() => setShowPii(!showPii)}
              className="w-full glass-card gradient-success px-3 py-2.5 flex items-center gap-2.5 hover:bg-emerald-500/10 transition text-left border-emerald-500/20">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-emerald-300 flex-1">🔒 PII anonymized before external API calls</span>
              <svg className={`w-4 h-4 text-emerald-400 flex-shrink-0 transition-transform duration-300 ${showPii ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPii && (
              <div className="mt-2 space-y-2">
                {analysis.original_text && (
                  <div className="glass-card gradient-danger p-3 border-red-500/15">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70 mb-1 block">Original</span>
                    <p className="text-xs text-red-300/80 whitespace-pre-wrap leading-relaxed font-mono">{analysis.original_text}</p>
                  </div>
                )}
                {analysis.anonymized_text && (
                  <div className="glass-card gradient-success p-3 border-emerald-500/15">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70 mb-1 block">Anonymized</span>
                    <p className="text-xs text-emerald-300/80 whitespace-pre-wrap leading-relaxed font-mono">{analysis.anonymized_text}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Actions ═══ */}
        <div className="pt-2 space-y-2.5 fade-in" style={{ animationDelay: "0.35s" }}>
          {isThreat ? (
            <>
              <button
                onClick={handleConfirmThreat}
                disabled={isThreatConfirmed}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all duration-300 shadow-lg shadow-red-900/30 hover:shadow-red-900/50 active:scale-[0.98]"
              >
                {isThreatConfirmed ? "Threat Confirmed" : "Confirm Threat"}
              </button>
              {isThreat && (
                <button
                  onClick={onDeployHoneypot}
                  disabled={!isThreatConfirmed}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-200 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {honeypotSession ? "View Honeypot" : "Deploy Honeypot"}
                </button>
              )}
              <button
                onClick={onFalsePositive}
                disabled={honeypotSession?.isStreaming}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-all duration-300"
              >
                Flag False Positive
              </button>
            </>
          ) : (
            <>
              <div className="glass-card gradient-success px-3 py-3 flex items-center gap-2.5 border-emerald-500/20">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-emerald-300">No threat detected</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(RiskPanel);
