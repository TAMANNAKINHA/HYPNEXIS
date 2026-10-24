import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Rocket,
  XCircle,
  ShieldAlert,
  Snowflake,
  RefreshCw,
  Copy,
  Check,
  Lock,
  Clock,
  ExternalLink,
  KeyRound,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { useAegis, useOrchestrator } from '@/orchestrator';
import { formatINR } from '@/utils/format';
import { getPolicyByCategory, type PolicyProfile } from '@/constants/policyProfiles';
import type { Mission } from '@/types';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------
const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  cloud: { icon: '☁️', label: 'Cloud' },
  saas: { icon: '🤖', label: 'SaaS' },
  travel: { icon: '✈️', label: 'Travel' },
  payroll: { icon: '👨‍💼', label: 'Payroll' },
  procurement: { icon: '📦', label: 'Procurement' },
  marketing: { icon: '📢', label: 'Marketing' },
  professional: { icon: '💼', label: 'Professional' },
  general: { icon: '📄', label: 'General' },
};

function computeVerificationLevel(
  amount: number,
  thresholds: PolicyProfile['verificationThresholds'],
  riskScore?: number
) {
  if (riskScore !== undefined) {
    if (riskScore > 80)
      return { level: 3, label: 'Manual Review', desc: `High risk (${riskScore}%).` };
    if (riskScore > 70)
      return { level: 2, label: 'Phone Notification', desc: `Moderate risk (${riskScore}%).` };
  }
  if (amount >= thresholds.manual)
    return { level: 3, label: 'Manual Review', desc: `Exceeds ₹${thresholds.manual.toLocaleString()}.` };
  if (amount >= thresholds.phone)
    return { level: 2, label: 'Phone Notification', desc: `Exceeds ₹${thresholds.phone.toLocaleString()}.` };
  if (amount >= thresholds.otp)
    return { level: 1, label: 'OTP Required', desc: `Exceeds ₹${thresholds.otp.toLocaleString()}.` };
  return { level: 0, label: 'Auto-execute', desc: 'Within limits.' };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MissionWallet({ onViewPolicies }: { onViewPolicies: () => void }) {
  const { state, dispatch } = useAegis();
  const {
    executeMission,
    cancelMission,
    unfreezeWallet,
    rotateSessionKey,
  } = useOrchestrator();

  const missions = useMemo(
    () => (state.missions || []).filter((m: Mission) => m.status !== 'nuked'),
    [state.missions]
  );

  const selectedId = state.selectedMissionId;

  const latestId = useMemo(() => {
    if (missions.length === 0) return null;
    return missions.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).id;
  }, [missions]);

  const focusedId = useMemo(() => {
    if (selectedId && missions.some(m => m.id === selectedId)) return selectedId;
    return latestId;
  }, [selectedId, latestId, missions]);

  const prevFocusedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (focusedId !== prevFocusedIdRef.current) {
      prevFocusedIdRef.current = focusedId;
      if (focusedId !== selectedId) {
        dispatch({ type: 'SELECT_MISSION', payload: focusedId });
      }
    }
  }, [focusedId, selectedId, dispatch]);

  useEffect(() => {
    if (focusedId && !missions.some(m => m.id === focusedId)) {
      dispatch({ type: 'SELECT_MISSION', payload: null });
    }
  }, [focusedId, missions, dispatch]);

  const focusedMission = focusedId ? missions.find(m => m.id === focusedId) : null;
  const pocketMissions = missions.filter(m => m.id !== focusedId);

  const handleExecute = useCallback((id: string) => executeMission(id), [executeMission]);
  const handleCancel = useCallback((id: string) => cancelMission(id), [cancelMission]);
  const handleUnfreeze = useCallback((id: string) => unfreezeWallet(id), [unfreezeWallet]);
  const handleRotateKey = useCallback((id: string) => rotateSessionKey(id), [rotateSessionKey]);

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto max-h-full">
      {/* Pocket stack (older missions) */}
      {pocketMissions.length > 0 && (
        <div className="flex flex-col gap-2 relative">
          {pocketMissions.map((mission, index) => (
            <MissionPocket
              key={mission.id}
              mission={mission}
              onClick={() => dispatch({ type: 'SELECT_MISSION', payload: mission.id })}
              stackIndex={index}
              totalPockets={pocketMissions.length}
            />
          ))}
        </div>
      )}

      {/* Full detail card for focused mission */}
      {focusedMission ? (
        <MissionDetail
          mission={focusedMission}
          onExecute={() => handleExecute(focusedMission.id)}
          onCancel={() => handleCancel(focusedMission.id)}
          onUnfreeze={() => handleUnfreeze(focusedMission.id)}
          onRotateKey={() => handleRotateKey(focusedMission.id)}
          onViewPolicies={onViewPolicies}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center opacity-70">
          <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center mb-4 border border-gold/20">
            <ShieldAlert className="h-8 w-8 text-gold" strokeWidth={1.5} />
          </div>
          <p className="text-[16px] font-bold text-white tracking-wide">No Active Mission Wallet</p>
          <p className="text-[12px] text-ink-faint mt-1">Create a new mission from the console</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enhanced Pocket card with subtle glow and stack effect
// ---------------------------------------------------------------------------
function MissionPocket({
  mission,
  onClick,
  stackIndex,
  totalPockets,
}: {
  mission: Mission;
  onClick: () => void;
  stackIndex: number;
  totalPockets: number;
}) {
  const isNew = Date.now() - mission.createdAt < 3000; // pulse if created within 3 seconds
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl border border-gold/15 bg-bg-secondary/60 backdrop-blur-xl px-4 py-2 flex items-center justify-between hover:bg-bg-secondary/80 transition-colors shadow-gold-sm ${
        isNew ? 'animate-pulse border-gold/30' : ''
      }`}
      style={{
        transform: `scale(${1 - stackIndex * 0.02})`,
        zIndex: totalPockets - stackIndex,
        marginBottom: stackIndex === totalPockets - 1 ? 0 : -4,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="text-xl">{CATEGORY_META[mission.category || 'general']?.icon || '📄'}</div>
        <div>
          <div className="text-[12px] font-bold text-white">{mission.name}</div>
          <div className="text-[10px] text-ink-faint flex items-center gap-2">
            <span>{mission.merchant}</span>
            <span>•</span>
            <span>{formatINR(mission.budget)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={mission.status} />
        <ChevronUp className="h-4 w-4 text-ink-dim" />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Full detail card – enhanced with glowing borders and bolder status
// ---------------------------------------------------------------------------
function MissionDetail({
  mission,
  onExecute,
  onCancel,
  onUnfreeze,
  onRotateKey,
  onViewPolicies,
}: {
  mission: Mission;
  onExecute: () => void;
  onCancel: () => void;
  onUnfreeze: () => void;
  onRotateKey: () => void;
  onViewPolicies: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [keysRotated, setKeysRotated] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (mission.status === 'frozen') setKeysRotated(false);
  }, [mission.status]);

  const policy = useMemo(() => {
    const cat = mission.category;
    return (cat ? getPolicyByCategory(cat) : null) ||
      getPolicyByCategory('general') ||
      ({
        id: 'fallback',
        name: 'General',
        icon: '📄',
        defaultBudget: 10000,
        allowedVendors: [] as string[],
        verificationThresholds: { otp: 5000, phone: 10000, manual: 15000 },
        timelockSeconds: 60,
        trustRequirement: 'medium' as const,
        fallback: 'manual_review' as const,
      });
  }, [mission.category]);

  const totalTime = policy.timelockSeconds || 60;
  const [localTimer, setLocalTimer] = useState(totalTime);

  useEffect(() => {
    setLocalTimer(totalTime);
  }, [totalTime, mission.id]);

  useEffect(() => {
    if (mission.status === 'executing') {
      const interval = setInterval(() => setLocalTimer(prev => (prev > 0 ? prev - 1 : 0)), 1000);
      return () => clearInterval(interval);
    }
    if (mission.status === 'completed') setLocalTimer(0);
  }, [mission.status]);

  const isExecuting = mission.status === 'executing';
  const isFrozen = mission.status === 'frozen';
  const isFailed = ['failed', 'nuked', 'cancelled'].includes(mission.status);
  const isCompleted = mission.status === 'completed';

  const handleCopyKey = () => {
    if (mission.sessionKey) {
      navigator.clipboard.writeText(mission.sessionKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncatedKey = mission.sessionKey
    ? `${mission.sessionKey.slice(0, 6)}...${mission.sessionKey.slice(-4)}`
    : 'None';

  const categoryMeta = mission.category ? CATEGORY_META[mission.category] : CATEGORY_META.general;
  const formattedExpiry = new Date(mission.expiry).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Time‑lock bar – enhanced glow
  let displayTime = totalTime;
  let progress = 100;
  let timerStatusText = 'Awaiting execution clearance...';
  let timerTheme = {
    border: 'border-warning/50',
    bg: 'bg-warning/10',
    text: 'text-warning',
    fill: 'bg-warning',
    ping: true,
    glow: '',
  };

  if (isExecuting && !isFrozen) {
    displayTime = localTimer;
    progress = (localTimer / totalTime) * 100;
    timerStatusText = 'Smart contract time-lock active...';
    timerTheme.glow = 'shadow-[0_0_20px_rgba(245,158,11,0.3)]';
  } else if (isFrozen) {
    displayTime = localTimer;
    progress = (localTimer / totalTime) * 100;
    timerStatusText = 'Time-lock PAUSED – system lockdown.';
    timerTheme = {
      border: 'border-error/50',
      bg: 'bg-error/10',
      text: 'text-error',
      fill: 'bg-error',
      ping: false,
      glow: 'shadow-[0_0_25px_rgba(239,68,68,0.4)]',
    };
  } else if (isCompleted) {
    displayTime = 0;
    progress = 100;
    timerStatusText = 'Time-lock cleared. Funds released.';
    timerTheme = {
      border: 'border-success/50',
      bg: 'bg-success/10',
      text: 'text-success',
      fill: 'bg-success',
      ping: false,
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    };
  } else if (isFailed) {
    displayTime = localTimer;
    progress = 100;
    timerStatusText = 'Mission aborted. Escrow locked.';
    timerTheme = {
      border: 'border-error/50',
      bg: 'bg-error/10',
      text: 'text-error',
      fill: 'bg-error',
      ping: false,
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    };
  }

  const verification = useMemo(
    () => computeVerificationLevel(mission.budget, policy.verificationThresholds, mission.riskScore),
    [mission.budget, mission.riskScore, policy]
  );

  const handleRotateAndEnableUnfreeze = async () => {
    await onRotateKey();
    setKeysRotated(true);
  };

  const handleCancelClick = () => setShowCancelConfirm(true);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    try {
      await onCancel();
      setShowCancelConfirm(false);
    } catch {
      // handled
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col p-6 relative overflow-hidden bg-bg-secondary/40 rounded-xl shadow-soft-lg">
      {isFrozen && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-lg p-6 text-center border-2 border-error/50">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-error/15 border-2 border-error/40 text-error mb-4 animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.3)]">
            <Snowflake className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-widest">System Locked Down</h3>
          <p className="text-[12px] font-medium text-ink-dim max-w-[300px] mt-2 mb-8">
            Emergency override active. Rotate session key first, then unfreeze.
          </p>
          <div className="flex w-full gap-3 max-w-[350px]">
            <button
              onClick={handleRotateAndEnableUnfreeze}
              className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-gold/20 border border-gold/40 text-gold px-4 py-3.5 text-[13px] font-bold hover:bg-gold/30 transition-all"
            >
              <RefreshCw className="h-4 w-4" /> Rotate Key
            </button>
            <button
              onClick={onUnfreeze}
              disabled={!keysRotated}
              className={`flex-1 flex justify-center items-center gap-2 rounded-xl bg-success/20 border border-success/40 px-4 py-3.5 text-[13px] font-bold transition-all ${
                keysRotated ? 'text-success hover:bg-success/30' : 'text-ink-faint opacity-50 cursor-not-allowed'
              }`}
            >
              <Snowflake className="h-4 w-4" /> Unfreeze
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation overlay */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm rounded-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              className="w-full max-w-xs rounded-xl border border-error/40 bg-bg-card p-5 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-error mb-3">
                <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                <h4 className="text-sm font-bold">Cancel Mission</h4>
              </div>
              <p className="text-xs text-ink-dim mb-4">
                Are you sure you want to cancel this mission? The budget will be refunded.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelling}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 text-ink-dim hover:bg-white/5 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-error text-white hover:bg-error/90 transition-colors flex items-center gap-1.5"
                >
                  {cancelling ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Yes, Cancel
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gold/15 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 shadow-gold-sm">
            <CreditCard className="h-6 w-6 text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-black text-white tracking-wide">{mission.name}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] font-mono font-bold text-gold/60">{mission.missionId}</span>
              <span className="text-ink-faint">|</span>
              <button
                onClick={handleCopyKey}
                className="group flex items-center gap-1 font-mono text-[11px] font-medium text-ink-dim hover:text-white transition-colors bg-white/5 px-2 py-0.5 rounded"
              >
                <Lock className="h-3 w-3 text-gold/60" />
                <span>{truncatedKey}</span>
                {copied ? (
                  <Check className="h-3 w-3 text-success ml-1" />
                ) : (
                  <Copy className="h-3 w-3 opacity-40 group-hover:opacity-100 ml-1" />
                )}
              </button>
            </div>
          </div>
        </div>
        <StatusBadge status={mission.status} />
      </div>

      {/* Merchant & Budget */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Detail label="Target Merchant" value={mission.merchant} />
        <div className="rounded-xl border-2 border-gold/60 bg-gold/10 p-4 shadow-[0_0_25px_rgba(212,175,55,0.15)] relative overflow-hidden transition-all hover:border-gold">
          <div className="absolute top-0 right-0 bg-gold text-black text-[9px] font-black px-2.5 py-1 rounded-bl-lg uppercase tracking-widest">
            Escrowed
          </div>
          <div className="text-[10px] uppercase tracking-widest text-gold font-bold mb-1.5">Budget Locked</div>
          <div className="text-2xl font-black text-white">{formatINR(mission.budget ?? 0)}</div>
        </div>
        <Detail label="Capital Deployed" value={formatINR(mission.spent ?? 0)} />
        <Detail label="Session Expiry" value={formattedExpiry} />
      </div>

      {mission.explorerUrl && (
        <div className="mt-3 flex items-center justify-end">
          <a
            href={mission.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-gold/80 hover:text-gold transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="underline">View on BaseScan</span>
          </a>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{categoryMeta.icon}</div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-bold mb-1">Authorized Scope</div>
              <div className="text-[15px] font-black text-white tracking-widest uppercase">{categoryMeta.label}</div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-[10px] uppercase tracking-widest text-ink-faint font-bold mb-1.5">Approved Vendors</div>
            <div className="flex flex-wrap justify-end gap-1.5 max-w-[180px] sm:max-w-[180px]">
              {policy.allowedVendors?.length ? (
                policy.allowedVendors.map((v: string) => (
                  <span
                    key={v}
                    className="text-[9px] font-mono font-bold text-gold/90 bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded"
                  >
                    {v}
                  </span>
                ))
              ) : (
                <span className="text-[9px] font-mono text-white/70 bg-white/10 px-1.5 py-0.5 rounded">
                  Any Vendor (General)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20 text-warning">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-warning/70 font-bold mb-0.5">Execution Delay</div>
              <div className="text-[12px] font-bold text-white">{totalTime}-Sec Time-Lock</div>
            </div>
          </div>
          <div
            className={`rounded-xl border ${
              verification?.level === 0
                ? 'border-success/20 bg-success/5'
                : 'border-warning/20 bg-warning/5'
            } p-3.5 flex items-center gap-3`}
          >
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center border border-success/20 text-success">
              {verification?.level === 0 && <Check className="h-4 w-4" />}
              {verification?.level === 1 && <KeyRound className="h-4 w-4" />}
              {verification?.level === 2 && <PhoneCall className="h-4 w-4" />}
              {verification?.level === 3 && <ShieldAlert className="h-4 w-4" />}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-success/70 font-bold mb-0.5">Verification Rule</div>
              <div className="text-[12px] font-bold text-white">{verification?.label || 'Auto-execute'}</div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl border-2 ${timerTheme.border} ${timerTheme.bg} p-5 shadow-lg relative overflow-hidden transition-colors duration-500 ${timerTheme.glow}`}
      >
        <div className="flex items-end justify-between mb-3 relative z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {timerTheme.ping && <div className={`h-3 w-3 rounded-full ${timerTheme.fill} animate-ping`} />}
              {!timerTheme.ping && <div className={`h-3 w-3 rounded-full ${timerTheme.fill}`} />}
              <span className={`text-[12px] font-black tracking-widest ${timerTheme.text} uppercase`}>
                Escrow Time-Lock
              </span>
            </div>
            <span className={`text-[10px] font-medium ${timerTheme.text} opacity-80`}>{timerStatusText}</span>
          </div>
          <span className={`text-3xl font-mono font-black ${timerTheme.text} tracking-tighter`}>
            00:{displayTime.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-black/60 overflow-hidden relative z-10 shadow-inner">
          <motion.div
            className={`h-full ${timerTheme.fill}`}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear', duration: isExecuting && !isFrozen ? 1 : 0.3 }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-3">
        {mission.status === 'created' && (
          <>
            <button
              onClick={onExecute}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold text-bg py-4 text-[14px] font-black uppercase tracking-wider shadow-gold hover:scale-[1.02] transition-transform"
            >
              <Rocket className="h-5 w-5" /> Execute
            </button>
            <button
              onClick={handleCancelClick}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-white/10 text-white py-4 text-[14px] font-bold hover:bg-white/5 transition-colors"
            >
              Cancel Mission
            </button>
          </>
        )}
        {isExecuting && !isFrozen && (
          <button
            onClick={handleCancelClick}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-error/90 text-white py-4 text-[14px] font-black uppercase tracking-wider transition-all hover:bg-error hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
          >
            <XCircle className="h-5 w-5" /> Abort Transaction
          </button>
        )}
        {(isFailed || isCompleted) && (
          <button
            disabled
            className="w-full rounded-xl bg-white/5 border border-white/5 text-ink-faint py-4 text-[13px] font-bold uppercase tracking-widest cursor-not-allowed"
          >
            Mission Lifecycle Concluded
          </button>
        )}
      </div>

      <div className="absolute top-5 right-5 text-[10px] font-mono font-bold tracking-widest text-ink-faint">
        <button onClick={onViewPolicies} className="underline hover:text-gold transition-colors uppercase">
          View Internal Policy
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components (unchanged)
// ---------------------------------------------------------------------------
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-[10px] uppercase tracking-widest text-ink-dim font-bold mb-1.5">{label}</div>
      <div className="text-[14px] font-bold text-white">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    idle: { bg: 'bg-white/5', text: 'text-ink-faint', border: 'border-white/10' },
    created: { bg: 'bg-gold/10', text: 'text-gold', border: 'border-gold/30' },
    awaiting_otp: { bg: 'bg-warning/10', text: 'text-warning animate-pulse', border: 'border-warning/40' },
    awaiting_review: { bg: 'bg-warning/10', text: 'text-warning animate-pulse', border: 'border-warning/40' },
    executing: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/40' },
    completed: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/40' },
    cancelled: { bg: 'bg-white/5', text: 'text-ink-dim', border: 'border-white/10' },
    failed: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/30' },
    frozen: { bg: 'bg-error/15', text: 'text-error animate-pulse', border: 'border-error/50' },
    nuked: { bg: 'bg-error/20', text: 'text-error', border: 'border-error/50' },
  };
  const c = config[status] || config.idle;
  return (
    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${c.bg} ${c.border} ${c.text}`}>
      {status.replace('_', ' ')}
    </div>
  );
}