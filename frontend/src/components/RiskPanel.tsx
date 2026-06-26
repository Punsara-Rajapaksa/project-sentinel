import React, { useState } from "react";
import type { AnalysisResponse } from "../api";

interface RiskPanelProps {
  analysis: AnalysisResponse | null;
  loading: boolean;
  error: string | null;
  onConfirmThreat: () => void;
  onFalsePositive: () => void;
  onDismiss: () => void;
}

// ── Static color maps ──
const BAR_COLOR: Record<string, string> = {
  red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500",
};
const TIER_COLOR: Record<string, string> = {
  High: "bg-red-100 text-red-700 border-red-300",
  Medium: "bg-amber-100 text-amber-700 border-amber-300",
  Low: "bg-green-100 text-green-700 border-green-300",
};
const REC_COLOR: Record<string, string> = {
  "Report & Archive": "bg-red-100 text-red-700 border-red-300",
  "Do Not Engage": "bg-amber-100 text-amber-700 border-amber-300",
  "Proceed with Caution": "bg-green-100 text-green-700 border-green-300",
};

const safePct = (val: number | undefined | null): string => {
  if (val == null || Number.isNaN(val)) return "—";
  return `${Math.round(val * 100)}%`;
};
const safeNum = (val: number | undefined | null): number => {
  if (val == null || Number.isNaN(val)) return 0;
  return val;
};

// ── Tiny agent badge ──
const AgentBadge: React.FC<{ id: number; label: string }> = ({ id, label }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
    <span className="text-emerald-600 font-bold">A{id}</span> {label}
  </span>
);

const dangerBar = (pct: number) => {
  const hue = pct > 0.66 ? "red" : pct > 0.33 ? "amber" : "green";
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all duration-700 ${BAR_COLOR[hue]}`}
        style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
};

const RiskPanel: React.FC<RiskPanelProps> = ({
  analysis, loading, error, onConfirmThreat, onFalsePositive, onDismiss,
}) => {
  const [showPii, setShowPii] = useState(false);
  const [showVerification, setShowVerification] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-b-emerald-500 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Analyzing message…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-red-800 mb-1">Analysis Error</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Select a message from the inbox to view the risk analysis report.
        </p>
      </div>
    );
  }

  const tier = analysis.risk_tier || "Low";
  const isThreat = tier === "High" || tier === "Medium";
  const rec = analysis.recommendation || "";
  const vd = analysis.verification_details;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 space-y-4">

        {/* ═══ Agent 4: Final Verdict ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AgentBadge id={4} label="Explainer" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Final Verdict</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            {/* Row 1: tier + score */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full border text-xs font-bold ${TIER_COLOR[tier] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
                {tier} Risk
              </span>
              <div className="text-right">
                <span className="text-2xl font-bold text-gray-800">{safePct(analysis.composite_risk_score)}</span>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Composite Score</div>
              </div>
            </div>
            {/* Row 2: recommendation */}
            {rec && (
              <div className={`px-3 py-2 rounded-lg border text-xs font-bold text-center ${REC_COLOR[rec] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
                {rec}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Agent 2: Semantic Risk Scores ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AgentBadge id={2} label="Semantic" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Behavioral Analysis</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 font-medium">Urgency Pressure</span>
                <span className="text-gray-800 font-semibold">{safePct(analysis.urgency_score)}</span>
              </div>
              {dangerBar(safeNum(analysis.urgency_score))}
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 font-medium">Authority Manipulation</span>
                <span className="text-gray-800 font-semibold">{safePct(analysis.authority_manipulation_score)}</span>
              </div>
              {dangerBar(safeNum(analysis.authority_manipulation_score))}
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 font-medium">Known-Scam Similarity</span>
                <span className="text-gray-800 font-semibold">{safePct(analysis.structural_similarity_score)}</span>
              </div>
              {dangerBar(safeNum(analysis.structural_similarity_score))}
            </div>
          </div>
        </div>

        {/* ═══ Agent 3: Verification ═══ */}
        {vd && (
          <div>
            <button onClick={() => setShowVerification(!showVerification)} className="w-full flex items-center gap-2 mb-2 text-left">
              <AgentBadge id={3} label="OSINT" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wider flex-1">Technical Verification</span>
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showVerification ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showVerification && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2 text-xs">
                {/* Authenticity bar */}
                <div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sender Authenticity</span>
                    <span className={`font-semibold ${safeNum(analysis.authenticity_confidence_score) < 0.4 ? "text-red-600" : safeNum(analysis.authenticity_confidence_score) < 0.7 ? "text-amber-600" : "text-green-600"}`}>
                      {safePct(analysis.authenticity_confidence_score)}
                    </span>
                  </div>
                  {dangerBar(safeNum(analysis.authenticity_confidence_score))}
                </div>
                <hr className="border-gray-100" />
                {vd.domain && (
                  <div className="flex justify-between"><span className="text-gray-500">Domain</span><span className="text-gray-800 font-mono text-[11px]">{vd.domain}</span></div>
                )}
                {vd.domain_age_days != null && (
                  <div className="flex justify-between"><span className="text-gray-500">Domain Age</span><span className={`font-semibold ${vd.domain_age_days < 90 ? "text-red-600" : "text-green-600"}`}>{vd.domain_age_days} days</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">SPF Record</span><span className={`font-semibold ${vd.spf_valid ? "text-green-600" : "text-red-600"}`}>{vd.spf_valid ? "✓ Valid" : "✗ Invalid"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">DKIM Record</span><span className={`font-semibold ${vd.dkim_valid ? "text-green-600" : "text-red-600"}`}>{vd.dkim_valid ? "✓ Valid" : "✗ Invalid"}</span></div>
                {vd.typosquatting_detected && (
                  <div className="flex justify-between"><span className="text-gray-500">Typosquatting</span><span className="text-red-600 font-semibold">⚠ Detected</span></div>
                )}
                {vd.malicious_urls && vd.malicious_urls.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-1">Suspicious URLs</span>
                    {vd.malicious_urls.map((url, i) => (
                      <div key={i} className="text-red-600 font-mono truncate bg-red-50 rounded px-2 py-0.5 mt-0.5 text-[11px]">{url}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Agent 2: Assessment + Risk Factors ═══ */}
        <div>
          <div className="mb-2">
            <AgentBadge id={2} label="Semantic" />
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Assessment</h4>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                {analysis.risk_assessment || "No assessment available."}
              </p>
            </div>
            {analysis.risk_factors && analysis.risk_factors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Risk Factors</h4>
                <ul className="space-y-1.5">
                  {analysis.risk_factors.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 bg-amber-50 rounded px-3 py-2 border border-amber-100">
                      <span className="text-amber-500 font-bold flex-shrink-0">⚠</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Agent 1: Ingestion Summary ═══ */}
        <div>
          <AgentBadge id={1} label="Ingestion" />
          <div className="mt-2 bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Sender</span><span className="text-gray-800 font-mono">{analysis.sender || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Subject</span><span className="text-gray-800 truncate max-w-[180px]">{analysis.subject || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Request ID</span><span className="text-gray-400 font-mono text-[10px]">{analysis.request_id?.slice(0, 12)}…</span></div>
          </div>
        </div>

        {/* ═══ PII Privacy Toggle ═══ */}
        {analysis.is_anonymized && (
          <div>
            <button onClick={() => setShowPii(!showPii)}
              className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5 hover:bg-emerald-100 transition text-left">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-emerald-800 flex-1">🔒 PII automatically anonymized before external API call</span>
              <svg className={`w-4 h-4 text-emerald-600 flex-shrink-0 transition-transform ${showPii ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPii && (
              <div className="mt-2 space-y-2">
                {analysis.original_text && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1 block">Original Message</span>
                    <p className="text-xs text-red-800 whitespace-pre-wrap leading-relaxed font-mono">{analysis.original_text}</p>
                  </div>
                )}
                {analysis.anonymized_text && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-1 block">Anonymized Message</span>
                    <p className="text-xs text-green-800 whitespace-pre-wrap leading-relaxed font-mono">{analysis.anonymized_text}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Actions ═══ */}
        <hr className="border-gray-200" />
        {isThreat ? (
          <div className="space-y-2.5">
            <button onClick={onConfirmThreat} className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition">Confirm Threat</button>
            <button onClick={onFalsePositive} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition">Flag False Positive</button>
            <button onClick={onDismiss} className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition">Dismiss</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-green-800">No threat detected — no action needed</span>
            </div>
            <button onClick={onDismiss} className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition">Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(RiskPanel);
