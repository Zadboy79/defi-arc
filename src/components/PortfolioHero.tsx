import { useEffect, useRef, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownToLine, ArrowUpFromLine, Send, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { ConnectKitButton } from 'connectkit'
import { getUsdc, buildAddressExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { useLerpedNumber } from '@/hooks/useLerpedNumber'

const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!

// Sparkline built from running balance snapshots
function Sparkline({ data, color = 'var(--success)' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const w = 160
  const h = 36
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  const lastX = w.toFixed(1)
  const lastY = (h - ((data[data.length - 1] - min) / range) * (h - 6) - 3).toFixed(1)
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <circle cx={lastX} cy={lastY} r={3} fill={color} opacity={0.9} />
    </svg>
  )
}

const glass = {
  card: {
    background: 'rgba(255,255,255,0.68)',
    backdropFilter: 'blur(28px) saturate(200%)',
    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
    border: '1px solid rgba(255,255,255,0.72)',
    boxShadow: '0 12px 40px rgba(18,45,69,0.10), inset 0 1px 0 rgba(255,255,255,0.60)',
  } as React.CSSProperties,
}

const spectral = 'linear-gradient(90deg, #5fbeff 0%, #af8ff4 33%, #f05c6b 66%, #ffcd83 100%)'

interface PortfolioHeroProps {
  vaultBalance: bigint | undefined
  vaultLoading: boolean
  pendingYield: bigint | undefined
  onAction: (action: 'deposit' | 'withdraw' | 'send') => void
}

export function PortfolioHero({ vaultBalance, vaultLoading, pendingYield, onAction }: PortfolioHeroProps) {
  const { address, isConnected } = useAccount()

  const { data: walletBalance, isLoading: walletLoading } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8_000 },
  })

  const walletNum = walletBalance !== undefined
    ? parseFloat(Amount.fromRaw(walletBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(4))
    : null
  const vaultNum = vaultBalance !== undefined
    ? parseFloat(Amount.fromRaw(vaultBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(4))
    : null
  const yieldNum = pendingYield !== undefined
    ? parseFloat(Amount.fromRaw(pendingYield, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(6))
    : null

  // Total = wallet + vault + pending yield
  const totalNum = walletNum !== null && vaultNum !== null ? walletNum + vaultNum + (yieldNum ?? 0) : null
  const displayTotal = useLerpedNumber(totalNum)

  // Build a sparkline from running snapshots of total value
  const [history, setHistory] = useState<number[]>([])
  const prevTotal = useRef<number | null>(null)
  useEffect(() => {
    if (totalNum === null) return
    if (prevTotal.current === null) {
      setHistory([totalNum])
      prevTotal.current = totalNum
      return
    }
    if (Math.abs(totalNum - prevTotal.current) > 0.0001) {
      setHistory((h) => [...h.slice(-29), totalNum])
      prevTotal.current = totalNum
    }
  }, [totalNum])

  const loading = walletLoading || vaultLoading

  const actions = [
    { key: 'deposit' as const, icon: ArrowDownToLine, label: 'Add Money', color: 'var(--accent)' },
    { key: 'withdraw' as const, icon: ArrowUpFromLine, label: 'Cash Out', color: 'var(--accent)' },
    { key: 'send' as const, icon: Send, label: 'Send', color: 'var(--accent)' },
  ]

  return (
    <motion.section
      className="rounded-3xl overflow-hidden"
      style={glass.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Spectral top strip */}
      <div className="h-[3px]" style={{ background: spectral }} />

      <div className="p-5">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TokenUSDC variant="branded" size={18} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
              Arc Testnet
            </span>
          </div>
          {address && (
            <a
              href={buildAddressExplorerUrl(ARC_TESTNET_ID, address)}
              target="_blank"
              rel="noreferrer"
              className="mono flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--subtle)' }}
            >
              {address.slice(0, 6)}…{address.slice(-4)}
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Hero number */}
        <div className="mb-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Total balance</span>
        </div>
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div key="disconnected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                —
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--subtle)' }}>Connect a wallet to view</p>
            </motion.div>
          ) : loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                <span className="animate-pulse">···</span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="loaded" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-baseline gap-2">
                <span className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                  ${displayTotal.toFixed(2)}
                </span>
                <span className="text-lg font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breakdown + sparkline */}
        {isConnected && !loading && (
          <div className="mt-3 flex items-end justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 font-medium" style={{ color: 'var(--subtle)' }}>Wallet</span>
                <span className="tabular-nums font-semibold" style={{ color: 'var(--ink-2)' }}>
                  ${walletNum !== null ? walletNum.toFixed(2) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 font-medium" style={{ color: 'var(--subtle)' }}>Vault</span>
                <span className="tabular-nums font-semibold" style={{ color: 'var(--ink-2)' }}>
                  ${vaultNum !== null ? vaultNum.toFixed(2) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 font-medium" style={{ color: 'var(--subtle)' }}>Yield</span>
                <span className="tabular-nums font-semibold" style={{ color: 'var(--success)' }}>
                  +${yieldNum !== null ? yieldNum.toFixed(6) : '0.000000'}
                </span>
              </div>
            </div>
            <div className="opacity-80">
              <Sparkline data={history.length >= 2 ? history : [0, 0]} />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="my-4 border-t" style={{ borderColor: 'rgba(18,45,69,0.07)' }} />

        {/* Action row */}
        {isConnected ? (
          <div className="grid grid-cols-3 gap-2">
            {actions.map(({ key, icon: Icon, label }) => (
              <motion.button
                key={key}
                onClick={() => onAction(key)}
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-xs font-semibold"
                style={{
                  background: 'rgba(18,45,69,0.05)',
                  border: '1px solid rgba(18,45,69,0.07)',
                  color: 'var(--ink-2)',
                }}
              >
                <div
                  className="flex size-8 items-center justify-center rounded-xl"
                  style={{ background: 'var(--accent)' }}
                >
                  <Icon className="size-4 text-white" />
                </div>
                {label}
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <ConnectKitButton label="Connect to get started" />
          </div>
        )}
      </div>
    </motion.section>
  )
}
