/**
 * API client for Project Sentinel backend
 */

export interface AnalysisResponse {
  sender: string;
  subject: string;
  body: string;
  risk_tier: string;
  urgency_score: number;
  authority_manipulation_score: number;
  structural_similarity_score: number;
  composite_risk_score: number;
  risk_assessment: string;
  risk_factors: string[];
  is_anonymized: boolean;
  request_id: string;
  original_text?: string;
  anonymized_text?: string;
  verification_details?: {
    domain: string;
    domain_age_days: number;
    spf_valid: boolean;
    dkim_valid: boolean;
    typosquatting_detected: boolean;
    malicious_urls: string[];
    error?: string;
  };
  authenticity_confidence_score?: number;
  recommendation?: string;
  honeypot_active?: boolean;
  honeypot_conversation?: Array<{ role: string; text: string }>;
  harvested_artifacts?: string[];
}

export interface HoneypotArtifact {
  type: string;
  value: string;
}

export interface HoneypotStreamEvent {
  type: "message" | "artifact" | "done";
  role?: "scammer" | "honeypot";
  text?: string;
  artifacts?: HoneypotArtifact[];
  conversation?: Array<{ role: string; text: string }>;
}

export interface AnalysisStreamEvent {
  agent: number | "done";
  label?: string;
  data: Partial<AnalysisResponse>;
}

/** Non-streaming analysis (used for pre-fetching) */
export async function analyzeMessage(message: string): Promise<AnalysisResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

/** Streaming analysis — calls callback as each agent completes */
export async function streamAnalysis(
  message: string,
  onAgent: (agent: number, label: string, data: Partial<AnalysisResponse>) => void,
  onComplete: (fullResult: AnalysisResponse) => void,
  onError: (error: Error) => void,
): Promise<void> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const simulateProgress = async (fullResult: AnalysisResponse) => {
    onAgent(1, "Ingestion", {
      sender: fullResult.sender,
      subject: fullResult.subject,
      body: fullResult.body,
      is_anonymized: fullResult.is_anonymized,
      request_id: fullResult.request_id,
    });
    await sleep(140);
    onAgent(2, "Semantic Risk", {
      urgency_score: fullResult.urgency_score,
      authority_manipulation_score: fullResult.authority_manipulation_score,
      structural_similarity_score: fullResult.structural_similarity_score,
      risk_assessment: fullResult.risk_assessment,
      risk_factors: fullResult.risk_factors,
      risk_tier: fullResult.risk_tier,
    });
    await sleep(140);
    onAgent(3, "Verification", {
      verification_details: fullResult.verification_details,
      authenticity_confidence_score: fullResult.authenticity_confidence_score,
    });
    await sleep(140);
    onAgent(4, "Explainer", {
      composite_risk_score: fullResult.composite_risk_score,
      recommendation: fullResult.recommendation,
      risk_tier: fullResult.risk_tier,
    });
    onComplete(fullResult);
  };

  try {
    const response = await fetch("/api/analyze/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (response.status === 404) {
      const fullResult = await analyzeMessage(message);
      await simulateProgress(fullResult);
      return;
    }
    if (!response.ok) throw new Error(`Stream error: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const event: AnalysisStreamEvent = JSON.parse(trimmed.slice(6));
            if (event.agent === "done") {
              onComplete(event.data as AnalysisResponse);
            } else if (typeof event.agent === "number") {
              onAgent(event.agent, event.label || "", event.data);
            }
          } catch { /* skip */ }
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      try {
        const event: AnalysisStreamEvent = JSON.parse(buffer.trim().slice(6));
        if (event.agent === "done") {
          onComplete(event.data as AnalysisResponse);
        } else if (typeof event.agent === "number") {
          onAgent(event.agent, event.label || "", event.data);
        }
      } catch { /* skip */ }
    }
  } catch (err) {
    try {
      const fullResult = await analyzeMessage(message);
      await simulateProgress(fullResult);
    } catch (fallbackErr) {
      onError(fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
      return;
    }
  }
}

/** Stream honeypot conversation via SSE */
export async function streamHoneypot(
  analysis: AnalysisResponse,
  onEvent: (event: HoneypotStreamEvent) => void,
  onError: (error: Error) => void,
): Promise<void> {
  try {
    const response = await fetch("/api/honeypot/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis }),
    });
    if (!response.ok) throw new Error(`Honeypot error: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const event: HoneypotStreamEvent = JSON.parse(trimmed.slice(6));
            onEvent(event);
          } catch { /* skip */ }
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      try {
        const event: HoneypotStreamEvent = JSON.parse(buffer.trim().slice(6));
        onEvent(event);
      } catch { /* skip */ }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Legacy sync honeypot (for tests) */
export async function startHoneypot(analysis: AnalysisResponse): Promise<AnalysisResponse> {
  const response = await fetch("/api/honeypot/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis }),
  });
  if (!response.ok) throw new Error(`Honeypot error: ${response.status}`);
  return response.json();
}
