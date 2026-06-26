/**
 * API wrapper for Project Sentinel backend
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
}

export async function analyzeMessage(message: string): Promise<AnalysisResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
