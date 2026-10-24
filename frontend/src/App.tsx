import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AegisProvider, useAegis } from '@/orchestrator';
import { TopNav } from '@/components/TopNav';
import { MainWallet } from '@/components/MainWallet';
import { MissionConsole } from '@/components/MissionConsole';
import { MissionWallet } from '@/components/MissionWallet';
import { SecurityEngine } from '@/components/SecurityEngine';
import { LiveTerminal } from '@/components/LiveTerminal';
import { DemoControls } from '@/components/DemoControls';
import { PaymentsView } from '@/components/PaymentsView';
import { Modals } from '@/components/Modals';
import { VerificationPrompt } from '@/components/VerificationPrompt'; // ✅ Imported Prompt

function Dashboard() {
  const { state } = useAegis();
  const [tab, setTab] = useState<'main' | 'missions' | 'payments'>('main');
  const [modal, setModal] = useState<'policies' | 'audit' | null>(null);

  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[400px] radial-gold-animated" />

      <div className="relative">
        <TopNav
          active={tab}
          onNavigate={setTab}
          walletStatus={state.walletStatus}
        />

        <main className="mx-auto max-w-[1800px] px-4 py-4 lg:px-6">
          <AnimatePresence mode="wait">
            {tab === 'main' ? (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <MainWallet />
              </motion.div>
            ) : tab === 'payments' ? (
              <motion.div
                key="payments"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <PaymentsView />
              </motion.div>
            ) : (
              <motion.div
                key="missions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <MissionsView onViewPolicies={() => setModal('policies')} onAuditTrail={() => setModal('audit')} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Modals open={modal} onClose={() => setModal(null)} />
        <VerificationPrompt /> {/* ✅ Added globally to catch all Verification Events */}
      </div>
    </div>
  );
}

function MissionsView({
  onViewPolicies,
  onAuditTrail,
}: {
  onViewPolicies: () => void;
  onAuditTrail: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4 xl:col-span-3">
        <div className="h-[70vh] overflow-hidden lg:h-[calc(100vh-7rem)] rounded-2xl border border-gold/15 bg-bg-secondary/60 backdrop-blur-xl">
          <MissionConsole />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-6">
        <div className="flex-1 overflow-hidden rounded-2xl border border-gold/15 bg-bg-secondary/60 backdrop-blur-xl">
          <MissionWallet onViewPolicies={onViewPolicies} />
        </div>
        <div className="h-[220px] shrink-0">
          <LiveTerminal />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-3">
        <div className="flex-1 overflow-hidden rounded-2xl border border-gold/15 bg-bg-secondary/60 backdrop-blur-xl">
          <SecurityEngine />
        </div>
        <DemoControls onAuditTrail={onAuditTrail} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AegisProvider>
      <Dashboard />
    </AegisProvider>
  );
}