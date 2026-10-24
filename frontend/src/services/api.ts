const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP error ${response.status}`);
  }
  return response.json();
}

// Define the expected response shape for mission creation
export interface CreateMissionResponse {
  success: boolean;
  mission: {
    id: string;
    name: string;
    missionId: string;
    merchant: string;
    budget: number;
    spent: number;
    expiry: string;
    trustScore: number;
    status: string;
    createdAt: number;
    userPrompt?: string;
    sessionKey: string;
    category?: string;
    policyId?: string;
    walletAddress?: string;
    contractTxHash?: string;
    explorerUrl?: string;
  };
}

export async function createMission(userPrompt: string): Promise<CreateMissionResponse> {
  const response = await fetch(`${API_BASE}/api/missions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: userPrompt }),
  });
  return handleResponse<CreateMissionResponse>(response);
}

export async function executeMission(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function cancelMission(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function freezeWallet(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/freeze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function unfreezeWallet(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/unfreeze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function nukeWallet(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/nuke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function rotateSessionKey(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/rotate-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function cancelPendingTx() {
  const response = await fetch(`${API_BASE}/api/missions/cancel-pending`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}

export async function togglePolicy(policyId: string) {
  const response = await fetch(`${API_BASE}/api/missions/toggle-policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyId }),
  });
  return handleResponse(response);
}

export async function resetDemo() {
  const response = await fetch(`${API_BASE}/api/missions/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}

export async function verifyOtp(missionId: string, otp: string) {
  const response = await fetch(`${API_BASE}/api/missions/verify/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId, otp }),
  });
  return handleResponse(response);
}

export async function rejectVerification(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/verify/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function approveVerification(missionId: string) {
  const response = await fetch(`${API_BASE}/api/missions/verify/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

// Attacks – now accept optional missionId
export async function simulatePromptInjection(missionId?: string) {
  const response = await fetch(`${API_BASE}/api/attacks/prompt-injection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function simulateStolenKey(missionId?: string) {
  const response = await fetch(`${API_BASE}/api/attacks/stolen-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}

export async function launchSpamAttack(missionId?: string) {
  const response = await fetch(`${API_BASE}/api/attacks/spam`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  return handleResponse(response);
}