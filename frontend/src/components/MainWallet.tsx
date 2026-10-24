import { motion } from 'framer-motion';
import {
  Building2,
  Landmark,
  Wallet,
  TrendingUp,
  Lock,
  ArrowUpRight,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { useAegis } from '@/orchestrator';
import { formatINR } from '@/utils/format';
import type { BankAccount } from '@/types';

export function MainWallet() {
  const { state } = useAegis();
  const profile = state?.profile;
  const bankAccounts = state?.bankAccounts || [];
  const reserveBalance = state?.reserveBalance ?? 0;
  const allocatedBalance = state?.allocatedBalance ?? 0;

  const totalLiquid = reserveBalance + allocatedBalance;
  const allocatedPct = totalLiquid > 0 ? (allocatedBalance / totalLiquid) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SectionCard icon={Building2} title="Account Owner" subtitle="Enterprise profile & authority limits">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/30 to-gold-dark/20 ring-1 ring-gold/30 text-[16px] font-bold text-white">
                RS
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-bold text-white">{profile?.owner || 'Rajesh Sharma'}</div>
                <div className="text-[12px] text-ink-dim">{profile?.role || 'CFO'}</div>
                <div className="mt-1">
                  <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                    {profile?.enterprise || 'Apex Labs India'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <LimitBar
                icon={Lock}
                label="Per-Mission Cap"
                spentLabel="Highest recorded spend"
                current={profile?.highestSpend || 0}
                limit={profile?.perMissionCap || 100000}
              />
              <LimitBar
                icon={TrendingUp}
                label="Daily Outflow Ceiling"
                spentLabel="Spent today"
                current={profile?.dailySpent || 0}
                limit={profile?.dailyOutflowCeiling || 300000}
              />
            </div>
          </SectionCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <SectionCard icon={Landmark} title="Connected Bank Accounts" subtitle="Corporate funding sources">
            <div className="space-y-3">
              {bankAccounts.length === 0 ? (
                <div className="text-[12px] text-ink-faint py-2">Awaiting secure backend sync...</div>
              ) : (
                bankAccounts.map((acct, i) => (
                  <BankRow key={acct.id} account={acct} index={i} />
                ))
              )}
            </div>
          </SectionCard>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <SectionCard icon={Wallet} title="Reserve Balances & Global Allocation" subtitle="Liquid capital vs. mission-allocated funds">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <BalanceTile
              icon={TrendingUp}
              label="Total Liquid Balance"
              value={formatINR(totalLiquid)}
              accent="gold"
            />
            <BalanceTile
              icon={Wallet}
              label="Available Reserve"
              value={formatINR(reserveBalance)}
              accent="success"
            />
            <BalanceTile
              icon={Rocket}
              label="Allocated to Missions"
              value={formatINR(allocatedBalance)}
              accent="warning"
            />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-medium text-ink-dim">Global Allocation</span>
              <span className="font-semibold text-white">{Math.round(allocatedPct)}% allocated</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-warning/60 to-warning"
                initial={{ width: 0 }}
                animate={{ width: `${allocatedPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              <motion.div
                className="h-full bg-gradient-to-r from-success/40 to-success"
                initial={{ width: 0 }}
                animate={{ width: `${100 - allocatedPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-ink-faint">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" /> Mission Wallets
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Available Reserve
              </span>
            </div>
          </div>
        </SectionCard>
      </motion.div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-2xl border border-gold/15 bg-bg-secondary/60 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold/10 ring-1 ring-gold/30">
          <Icon className="h-4 w-4 text-gold" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold tracking-wide text-white">{title}</h3>
          <p className="text-[10px] text-ink-faint">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function LimitBar({
  icon: Icon,
  label,
  spentLabel,
  current,
  limit,
}: {
  icon: LucideIcon;
  label: string;
  spentLabel: string;
  current: number;
  limit: number;
}) {
  const pct = limit > 0 ? (current / limit) * 100 : 0;
  return (
    <div className="rounded-xl border border-gold/10 bg-bg/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-dim">
          <Icon className="h-3 w-3 text-gold" strokeWidth={2.5} />
          {label}
        </span>
        <span className="text-[12px] font-semibold text-white">
          {formatINR(current)} / {formatINR(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-gold to-soft-gold-text"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ink-faint">
        <span>{spentLabel}</span>
        <span>{Math.round(pct)}% utilized</span>
      </div>
    </div>
  );
}

function BalanceTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: 'gold' | 'success' | 'warning';
}) {
  const colors = {
    gold: 'text-gold',
    success: 'text-success',
    warning: 'text-warning',
  };
  return (
    <div className="rounded-xl border border-gold/10 bg-bg/40 p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${colors[accent]}`} strokeWidth={2} />
        <span className="text-[10px] font-medium tracking-wide text-ink-faint">{label}</span>
      </div>
      <div className={`mt-2 text-[20px] font-bold ${colors[accent]}`}>{value}</div>
    </div>
  );
}

function BankRow({ account, index }: { account: BankAccount; index: number }) {
  const statusConfig = {
    connected: { label: 'Connected', color: 'text-success', dot: 'bg-success' },
    syncing: { label: 'Syncing', color: 'text-warning', dot: 'bg-warning animate-pulse' },
    error: { label: 'Error', color: 'text-error', dot: 'bg-error' },
  };
  const c = statusConfig[account.status] || statusConfig.connected;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className="group flex items-center gap-3 rounded-xl border border-gold/15 bg-gradient-to-br from-bg-card to-bg-secondary p-4 transition-all hover:border-gold/30 hover:shadow-gold-sm"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10">
        <Landmark className="h-5 w-5 text-gold" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white">{account.bank}</span>
          <div className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            <span className={`text-[9px] font-medium ${c.color}`}>{c.label}</span>
          </div>
        </div>
        <div className="mt-0.5 text-[10px] text-ink-faint">{account.label} · {account.type}</div>
        <div className="mt-0.5 font-mono text-[10px] text-ink-faint">
          A/c ••••{account.last4} · IFSC {account.ifsc}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-bold text-white">{formatINR(account.balance)}</div>
        <button className="mt-1 flex items-center justify-end gap-0.5 text-[10px] font-medium text-gold opacity-0 transition-opacity group-hover:opacity-100">
          Manage <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
}