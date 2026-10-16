import { useState, useEffect, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Zap, Loader2, ExternalLink, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { useLerpedNumber } from '@/hooks/useLerpedNumber'

const ARC_TESTNET_ID = 5042002

const glass = {
  card: {
    background: 'rgba(255,255,255,0.68)',
    backdropFilter: 'blur(28px) saturate(200%)',
    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
    border: '1px solid rgba(255,255,255,0.72)',
    boxShadow: '0 12px 40px rgba(18,45,69,0.10), inset 0 1px 0 rgba(255,255,255,0.60)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

interface EarnPanelProps {
  vaultAddress: `0x${string}` | undefined
  vaultAbi: readonly unknown[]
  vaultBalance: bigint | undefined
  pendingYield: bigint | undefined
  onOpenDeposit: () => void
  onOpenWithdraw: () => void
  onRefresh: () => void
}

export function EarnPanel({
  vaultAddress,
  vaultAbi,
  vaultBalance,
  pendingYield,
  onOpenDeposit,
  onOpenWithdraw,
  onRefresh,
}: EarnPanelProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = chainId !== ARC_TESTNET_ID

  // Live yield tick: interpolate onchain value locally between refreshes
  const [localYield, setLocalYield] = useState<number>(0)
  const yieldRef = useRef<number>(0)
  const rafRef = useRef(0)

  const onchainYield = pendingYield !== undefined
    ? parseFloat(Amount.fromRaw(pendingYield, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(8))
    : null
  const vaultBal = vaultBalance !== undefined
    ? parseFloat(Amount.fromRaw(vaultBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(6))
    : null

  // Tick local yield counter based on deposited principal + 5% APY
  useEffect(() => {
    if (onchainYield === null || vaultBal === null) return
    yieldRef.current = onchainYield
    const APY = 0.05
    const SECONDS_PER_YEAR = 365 * 24 * 3600
    const perSecond = (vaultBal * APY) / SECONDS_PER_YEAR

    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      yieldRef.current += perSecond * dt
      setLocalYield(yieldRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [onchainYield, vaultBal])

  const displayYield = useLerpedNumber(localYield, 0.06)

  const hasDeposit = vaultBal !== null && vaultBal > 0

  // Claim yield
  const { writeContract: claimYield, data: claimHash, isPending: claimPending, reset: resetClaim } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  if (claimSuccess) {
    toast.success('Yield recorded onchain')
    onRefresh()
    resetClaim()
  }

  const handleClaim = () => {
    if (!vaultAddress || !address) return
    if (wrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    claimYield({ address: vaultAddress, abi: vaultAbi, functionName: 'claimYield', args: [], chainId: ARC_TESTNET_ID })
  }

  return (
    <div className="space-y-3">
      {/* Vault position card */}
      <motion.div
        className="rounded-3xl overflow-hidden"
        style={glass.card}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl" style={{ background: 'rgba(26,128,71,0.12)' }}>
                <TrendingUp className="size-4" style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>USDC Savings Vault</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>Arc Testnet · 5% simulated APY</div>
              </div>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: hasDeposit ? 'rgba(26,128,71,0.10)' : 'rgba(18,45,69,0.06)', color: hasDeposit ? 'var(--success)' : 'var(--subtle)' }}
            >
              {hasDeposit ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Deposited + Yield split */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl p-3" style={glass.inner}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--subtle)' }}>You've saved</div>
              <div className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {address ? `$${vaultBal !== null ? vaultBal.toFixed(2) : '—'}` : '—'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>USDC deposited</div>
            </div>

            <div className="rounded-2xl p-3" style={{ ...glass.inner, border: '1px solid rgba(26,128,71,0.18)' }}>
              <div className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: 'var(--success)' }}>
                <Zap className="size-3" />
                Earning now
              </div>
              <div className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--success)' }}>
                {address && hasDeposit
                  ? `+$${displayYield.toFixed(6)}`
                  : '+$0.000000'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>yield pending</div>
            </div>
          </div>

          {/* APY detail row */}
          <div className="mb-4 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(26,128,71,0.05)', border: '1px solid rgba(26,128,71,0.10)' }}>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>Annual percentage yield</span>
              <span className="font-bold tabular-nums" style={{ color: 'var(--success)' }}>5.00% APY</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span style={{ color: 'var(--muted)' }}>Yield accrues</span>
              <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>every second</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span style={{ color: 'var(--muted)' }}>Smart contract</span>
              <span className="mono font-medium" style={{ color: 'var(--subtle)' }}>Arc Testnet</span>
            </div>
          </div>

          {/* Claim + CTA */}
          <div className="flex gap-2">
            <motion.button
              onClick={onOpenDeposit}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Add Money
            </motion.button>
            <motion.button
              onClick={handleClaim}
              disabled={!hasDeposit || claimPending || claimConfirming || !address}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              className="rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)', border: '1px solid rgba(26,128,71,0.15)' }}
            >
              {claimPending || claimConfirming
                ? <Loader2 className="size-4 animate-spin" />
                : 'Claim'}
            </motion.button>
            {hasDeposit && (
              <motion.button
                onClick={onOpenWithdraw}
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                className="rounded-2xl px-4 py-3 text-sm font-semibold"
                style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--ink-2)' }}
              >
                <ChevronRight className="size-4" />
              </motion.button>
            )}
          </div>

          {/* Claim receipt */}
          <AnimatePresence>
            {claimSuccess && claimHash && (
              <motion.div
                className="mt-3 rounded-xl px-3 py-2"
                style={{ background: 'rgba(26,128,71,0.06)' }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--success)' }}>Yield claimed</span>
                  <a
                    href={buildTxExplorerUrl(ARC_TESTNET_ID, claimHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 font-semibold"
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    View <ExternalLink className="size-3" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Info card */}
      <motion.div
        className="rounded-2xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.60)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-2)' }}>How it works</div>
        <div className="space-y-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          <div className="flex gap-2">
            <span className="font-bold tabular-nums" style={{ color: 'var(--accent)' }}>1.</span>
            <span>Add USDC to your vault — takes 2 wallet taps.</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold tabular-nums" style={{ color: 'var(--accent)' }}>2.</span>
            <span>Yield accrues every second at 5% APY, live onchain.</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold tabular-nums" style={{ color: 'var(--accent)' }}>3.</span>
            <span>Cash out your principal any time. Claim records yield onchain.</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
