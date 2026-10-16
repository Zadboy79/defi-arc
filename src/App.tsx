import { useState, useCallback } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, TrendingUp, Send, Sparkles } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'

import { PortfolioHero } from '@/components/PortfolioHero'
import { EarnPanel } from '@/components/EarnPanel'
import { SendPanel } from '@/components/SendPanel'
import { VaultSheet } from '@/components/VaultSheet'

// ── Vault contract ────────────────────────────────────────────────────────────
const VAULT_ADDRESS: `0x${string}` = '0x74b2e84aa55763ee0d4d4e216df780d035eafb59'

const VAULT_ABI = [
  { type: 'constructor', inputs: [{ name: '_usdc', type: 'address' }, { name: 'initialOwner', type: 'address' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'deposit', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdraw', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'claimYield', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balances', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'pendingYield', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalDeposited', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'yieldEarned', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'event', name: 'Deposited', inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }] },
  { type: 'event', name: 'Withdrawn', inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }] },
  { type: 'event', name: 'YieldClaimed', inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }] },
] as const

// ── Tab config ────────────────────────────────────────────────────────────────
type Tab = 'portfolio' | 'earn' | 'send'
const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'portfolio', icon: LayoutDashboard, label: 'Portfolio' },
  { id: 'earn', icon: TrendingUp, label: 'Earn' },
  { id: 'send', icon: Send, label: 'Send' },
]

// ── Background blobs ──────────────────────────────────────────────────────────
function Blobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div style={{ position: 'absolute', top: '5%', left: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.20) 0%, transparent 70%)', filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-5%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.18) 0%, transparent 70%)', filter: 'blur(68px)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '40%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(175,143,244,0.10) 0%, transparent 70%)', filter: 'blur(64px)' }} />
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="flex gap-1 rounded-2xl p-1"
      style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.70)',
        boxShadow: '0 4px 20px rgba(18,45,69,0.06)',
      }}
    >
      {TABS.map(({ id, icon: Icon, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors"
            style={{ color: isActive ? 'white' : 'var(--muted)' }}
          >
            {isActive && (
              <motion.span
                className="absolute inset-0 rounded-xl"
                layoutId="tab-pill"
                style={{ background: 'var(--accent)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="size-3.5" />
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('portfolio')
  const [sheet, setSheet] = useState<'deposit' | 'withdraw' | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Vault balance for connected user
  const { data: vaultBalance, isLoading: vaultLoading, refetch: refetchVaultBalance } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
    chainId: 5042002,
    query: { enabled: !!address, refetchInterval: 12_000 },
  })

  // Pending yield
  const { data: pendingYield, refetch: refetchYield } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'pendingYield',
    args: address ? [address] : undefined,
    chainId: 5042002,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })

  const handleVaultSuccess = useCallback(() => {
    onRefresh()
    void refetchVaultBalance()
    void refetchYield()
    setSheet(null)
  }, [onRefresh, refetchVaultBalance, refetchYield])

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <Blobs />

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        {/* Header */}
        <motion.header
          className="mb-6 flex items-center justify-between"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.30, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex size-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent)', boxShadow: '0 4px 12px rgba(18,45,69,0.18)' }}
            >
              <TokenUSDC variant="mono" size={18} className="text-white" />
            </div>
            <div>
              <div className="display text-base font-bold leading-tight" style={{ color: 'var(--ink)' }}>
                Arc DeFi
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="size-2.5" style={{ color: 'var(--muted)' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Powered by USDC on Arc</span>
              </div>
            </div>
          </div>

          <ConnectKitButton.Custom>
            {({ isConnected, show, address: addr }) => (
              <motion.button
                onClick={show}
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-full px-4 py-2 text-xs font-semibold"
                style={{
                  background: isConnected ? 'rgba(255,255,255,0.70)' : 'var(--accent)',
                  color: isConnected ? 'var(--ink-2)' : 'white',
                  backdropFilter: isConnected ? 'blur(12px)' : undefined,
                  border: isConnected ? '1px solid rgba(255,255,255,0.70)' : 'none',
                  boxShadow: isConnected ? '0 2px 8px rgba(18,45,69,0.08)' : '0 4px 12px rgba(18,45,69,0.18)',
                }}
              >
                {isConnected && addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect'}
              </motion.button>
            )}
          </ConnectKitButton.Custom>
        </motion.header>

        {/* Tab bar */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <TabBar active={tab} onChange={setTab} />
        </motion.div>

        {/* Tab content — key resets on refreshKey so reads re-fire after actions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${refreshKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {tab === 'portfolio' && (
              <PortfolioHero
                vaultBalance={vaultBalance}
                vaultLoading={vaultLoading}
                pendingYield={pendingYield}
                onAction={(action) => {
                  if (action === 'send') { setTab('send'); return }
                  setSheet(action === 'deposit' ? 'deposit' : 'withdraw')
                }}
              />
            )}

            {tab === 'earn' && (
              <EarnPanel
                vaultAddress={VAULT_ADDRESS}
                vaultAbi={VAULT_ABI}
                vaultBalance={vaultBalance}
                pendingYield={pendingYield}
                onOpenDeposit={() => setSheet('deposit')}
                onOpenWithdraw={() => setSheet('withdraw')}
                onRefresh={onRefresh}
              />
            )}

            {tab === 'send' && <SendPanel />}
          </motion.div>
        </AnimatePresence>

        {/* Onboarding nudge when disconnected */}
        <AnimatePresence>
          {!address && (
            <motion.div
              className="mt-4 rounded-2xl px-4 py-4"
              style={{
                background: 'rgba(255,255,255,0.58)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.68)',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ delay: 0.12, duration: 0.26 }}
            >
              <div className="mb-2 text-sm font-semibold text-center" style={{ color: 'var(--ink)' }}>
                Get started in 30 seconds
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs" style={{ color: 'var(--muted)' }}>
                <div className="space-y-1">
                  <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>1</div>
                  <div>Connect wallet</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>2</div>
                  <div>Get test USDC</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>3</div>
                  <div>Start earning</div>
                </div>
              </div>
              <div className="flex justify-center">
                <ConnectKitButton label="Connect to get started" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vault bottom sheet */}
      {sheet !== null && (
        <VaultSheet
          mode={sheet}
          open={true}
          onClose={() => setSheet(null)}
          vaultAddress={VAULT_ADDRESS}
          vaultAbi={VAULT_ABI}
          onSuccess={handleVaultSuccess}
        />
      )}
    </div>
  )
}
