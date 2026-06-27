/**
 * API wrapper for Project SudoShield backend
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
  // ── Agent 2 text fields ──
  original_text?: string;
  anonymized_text?: string;
  // ── Agent 3 verification ──
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
  // ── Agent 4 explainer ──
  recommendation?: string;
  // ── Agent 5 honeypot ──
  honeypot_active?: boolean;
  honeypot_conversation?: Array<{ role: string; text: string }>;
  harvested_artifacts?: string[];
}

export interface HoneypotStreamEvent {
  type: "message" | "artifact" | "done";
  role?: "scammer" | "honeypot";
  text?: string;
  artifacts?: string[];
  conversation?: Array<{ role: string; text: string }>;
}

export async function analyzeMessage(message: string): Promise<AnalysisResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Stream honeypot conversation via Server-Sent Events.
 * Calls the callback for each event as it arrives.
 */
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

    if (!response.ok) {
      throw new Error(`Honeypot stream error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events from the buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const jsonStr = trimmed.slice(6);
            const event: HoneypotStreamEvent = JSON.parse(jsonStr);
            onEvent(event);
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith("data: ")) {
      try {
        const event: HoneypotStreamEvent = JSON.parse(buffer.trim().slice(6));
        onEvent(event);
      } catch {
        // Skip
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Legacy synchronous honeypot call (kept for tests) */
export async function startHoneypot(analysis: AnalysisResponse): Promise<AnalysisResponse> {
  const response = await fetch("/api/honeypot/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis }),
  });
  if (!response.ok) {
    throw new Error(`Honeypot API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
