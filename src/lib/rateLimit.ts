/**
 * Rate Limiting Utility
 * 
 * Provides client-side rate limiting with IP-based cooldown periods.
 * Works in conjunction with backend rate limiting for maximum security.
 */

export type ActionType = 'order_placement' | 'admin_action';

interface RateLimitEntry {
  ip: string;
  actionType: ActionType;
  timestamp: number;
  expiresAt: number;
}

const RATE_LIMIT_STORAGE_KEY = 'starrs_rate_limits';
const DEFAULT_COOLDOWN_SECONDS = 30; // 30 seconds default, can be up to 60 seconds

/**
 * Get client IP address
 * In a browser environment, we'll use a fallback since we can't directly get IP
 * The actual IP will be captured server-side
 */
export function getClientIP(): string {
  // In browser, we can't get the real IP, so we use a session-based identifier
  // The actual IP will be captured by the backend
  let sessionId = sessionStorage.getItem('client_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('client_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Get stored rate limit entries from localStorage
 */
function getStoredRateLimits(): RateLimitEntry[] {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!stored) return [];
    
    const entries: RateLimitEntry[] = JSON.parse(stored);
    // Filter out expired entries
    const now = Date.now();
    return entries.filter(entry => entry.expiresAt > now);
  } catch (error) {
    console.error('Error reading rate limits from storage:', error);
    return [];
  }
}

/**
 * Save rate limit entries to localStorage
 */
function saveRateLimits(entries: RateLimitEntry[]): void {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Error saving rate limits to storage:', error);
  }
}

/**
 * Record an action for rate limiting
 */
export function recordAction(ip: string, actionType: ActionType, cooldownSeconds: number = DEFAULT_COOLDOWN_SECONDS): void {
  const entries = getStoredRateLimits();
  const now = Date.now();
  const expiresAt = now + (cooldownSeconds * 1000);
  
  // Remove existing entry for this IP and action type
  const filtered = entries.filter(
    entry => !(entry.ip === ip && entry.actionType === actionType)
  );
  
  // Add new entry
  filtered.push({
    ip,
    actionType,
    timestamp: now,
    expiresAt
  });
  
  saveRateLimits(filtered);
}

/**
 * Check if an action is allowed based on rate limiting
 * Returns true if allowed, false if still in cooldown
 */
export function checkRateLimit(
  ip: string,
  actionType: ActionType,
  cooldownSeconds: number = DEFAULT_COOLDOWN_SECONDS
): { allowed: boolean; cooldownRemaining?: number } {
  const entries = getStoredRateLimits();
  const now = Date.now();
  
  // Find the most recent entry for this IP and action type
  const recentEntry = entries
    .filter(entry => entry.ip === ip && entry.actionType === actionType)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  if (!recentEntry) {
    // No previous action, allow
    return { allowed: true };
  }
  
  // Check if cooldown has passed
  if (now >= recentEntry.expiresAt) {
    // Cooldown expired, allow
    return { allowed: true };
  }
  
  // Still in cooldown
  const cooldownRemaining = Math.ceil((recentEntry.expiresAt - now) / 1000);
  return {
    allowed: false,
    cooldownRemaining
  };
}

/**
 * Clear rate limit entries (useful for testing or admin override)
 */
export function clearRateLimits(ip?: string, actionType?: ActionType): void {
  if (!ip && !actionType) {
    // Clear all
    localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
    return;
  }
  
  const entries = getStoredRateLimits();
  const filtered = entries.filter(entry => {
    if (ip && entry.ip !== ip) return true;
    if (actionType && entry.actionType !== actionType) return true;
    return false;
  });
  
  saveRateLimits(filtered);
}

/**
 * Get formatted cooldown message
 */
export function getCooldownMessage(cooldownRemaining: number): string {
  if (cooldownRemaining < 60) {
    return `Please wait ${cooldownRemaining} second${cooldownRemaining !== 1 ? 's' : ''} before trying again.`;
  }
  const minutes = Math.floor(cooldownRemaining / 60);
  const seconds = cooldownRemaining % 60;
  return `Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''} before trying again.`;
}

