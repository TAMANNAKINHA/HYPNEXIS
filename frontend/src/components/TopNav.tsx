import { motion } from 'framer-motion';
import { Shield, Wallet, Rocket, CreditCard, type LucideIcon } from 'lucide-react';

interface TabItem {
  id: 'main' | 'missions' | 'payments';
  label: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { id: 'main', label: 'Main Wallet', icon: Wallet },
  { id: 'missions', label: 'Missions', icon: Rocket },
  { id: 'payments', label: 'Payments & Security', icon: CreditCard },
];

interface Props {
  active: 'main' | 'missions' | 'payments';
  onNavigate: (id: 'main' | 'missions' | 'payments') => void;
  walletStatus: 'empty' | 'active' | 'frozen' | 'nuked';
}

export function TopNav({ active, onNavigate, walletStatus }: Props) {
  const walletLabel =
    walletStatus === 'active'
      ? 'Active'
      : walletStatus === 'frozen'
        ? 'Frozen'
        : walletStatus === 'nuked'
          ? 'Destroyed'
          : 'No Wallet';

  const walletColor =
    walletStatus === 'active'
      ? 'text-success'
      : walletStatus === 'frozen'
        ? 'text-warning'
        : walletStatus === 'nuked'
          ? 'text-error'
          : 'text-ink-faint';

  return (
    <header className="sticky top-0 z-50 border-b border-gold/20 bg-bg-secondary/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-6 md:h-16 md:flex-nowrap md:py-0">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-dark shadow-gold"
          >
            <Shield className="h-5 w-5 text-bg" strokeWidth={2.5} />
          </motion.div>
          <div className="hidden leading-none sm:block">
            <div className="text-[15px] font-bold tracking-[0.2em] text-white">
              AEGIS
            </div>
            <div className="mt-0.5 text-[10px] font-medium tracking-wide text-gold/80">
              Mission Wallets for Autonomous AI
            </div>
          </div>
        </div>

        <nav className="order-last flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto md:overflow-visible">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] md:px-5 font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-ink-dim hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-white/5 ring-1 ring-gold/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" strokeWidth={2} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-2 rounded-full border border-gold/20 bg-bg-card/60 px-3 py-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${walletColor.replace(
                  'text-',
                  'bg-'
                )} ${walletStatus === 'active' ? 'animate-pulse' : ''}`}
              />
              <span className={`text-[11px] font-medium ${walletColor}`}>
                {walletLabel}
              </span>
            </div>
            {/* Trust badge removed */}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right leading-none md:block">
              <div className="text-[12px] font-semibold text-white">R. Sharma</div>
              <div className="mt-0.5 text-[10px] text-ink-faint">CFO · Apex Labs</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold/40 to-gold-dark/40 ring-1 ring-gold/30 flex items-center justify-center text-[12px] font-bold text-white">
              RS
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}