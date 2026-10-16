import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, CheckCircle, ExternalLink, X } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, parseAmount, usdcDecimalsFor } from '@/onchain-money'

const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!

const QUICK_AMOUNTS = ['1', '5', '10', '25']

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

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

export function SendPanel() {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = chainId !== ARC_TESTNET_ID

  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')

  const { data: walletBalance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8_000 },
  })

  const formattedBalance = walletBalance !== undefined
    ? Amount.fromRaw(walletBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : null

  let parsedAmount: ReturnType<typeof parseAmount> | null = null
  try {
    if (amount && parseFloat(amount) > 0) parsedAmount = parseAmount(ARC_TESTNET_ID, amount)
  } catch { parsedAmount = null }

  const validRecipient = isValidAddress(to)
  const insufficient = parsedAmount && walletBalance !== undefined && parsedAmount.raw > (walletBalance)
  const ready = !!parsedAmount && validRecipient && !insufficient && !!address

  const { writeContract: sendTx, data: hash, isPending, reset: resetSend, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleSend = useCallback(() => {
    if (!ready || !parsedAmount) return
    if (wrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    sendTx({
      address: usdcFact.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, parsedAmount.raw],
      chainId: ARC_TESTNET_ID,
    })
  }, [ready, parsedAmount, to, wrongChain, sendTx, switchChain])

  const handleReset = () => {
    resetSend()
    setAmount('')
    setTo('')
  }

  const parseOnchainError = (err: Error | null): string => {
    const msg = err?.message?.toLowerCase() ?? ''
    if (msg.includes('user rejected') || msg.includes('denied')) return 'Cancelled.'
    if (msg.includes('insufficient')) return 'Not enough USDC.'
    if (msg.includes('reverted')) return 'Transaction failed. Check the address and amount.'
    return 'Something went wrong. Please try again.'
  }

  if (isError) toast.error(parseOnchainError(error))

  return (
    <motion.div
      className="rounded-3xl overflow-hidden"
      style={glass.card}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl" style={{ background: 'rgba(18,45,69,0.08)' }}>
            <Send className="size-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Send USDC</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Instant transfer on Arc Testnet</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess && hash ? (
            <motion.div
              key="success"
              className="space-y-3"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex flex-col items-center py-4 gap-2">
                <CheckCircle className="size-10" style={{ color: 'var(--success)' }} />
                <div className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Sent!</div>
                <div className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                  ${parseFloat(amount).toFixed(2)} USDC delivered to {to.slice(0, 6)}…{to.slice(-4)}
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={buildTxExplorerUrl(ARC_TESTNET_ID, hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1 rounded-2xl py-3 text-xs font-semibold"
                  style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--ink-2)' }}
                >
                  View on ArcScan <ExternalLink className="size-3" />
                </a>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center rounded-2xl px-4 py-3"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Recipient */}
              <div className="rounded-2xl p-3" style={glass.inner}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--subtle)' }}>Recipient address</div>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value.trim())}
                  placeholder="0x…"
                  className="mono w-full bg-transparent text-sm outline-none"
                  style={{ color: 'var(--ink)', caretColor: 'var(--accent)' }}
                  spellCheck={false}
                />
                {to && !validRecipient && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>Not a valid address</p>
                )}
              </div>

              {/* Amount input */}
              <div className="rounded-2xl p-3" style={glass.inner}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <TokenUSDC variant="branded" size={14} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                  </div>
                  <button
                    disabled={!formattedBalance}
                    onClick={() => formattedBalance && setAmount(formattedBalance)}
                    className="text-xs font-semibold disabled:opacity-40"
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    {formattedBalance ? `Max ${formattedBalance}` : 'Balance unavailable'}
                  </button>
                </div>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                  }}
                  placeholder="0.00"
                  className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                  style={{ color: 'var(--ink)' }}
                />
                {insufficient && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>Amount exceeds your wallet balance</p>
                )}
              </div>

              {/* Quick amounts */}
              <div className="flex gap-1.5">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    className="flex-1 rounded-xl py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background: amount === q ? 'var(--accent)' : 'rgba(18,45,69,0.06)',
                      color: amount === q ? 'white' : 'var(--ink-2)',
                    }}
                  >
                    ${q}
                  </button>
                ))}
              </div>

              {/* CTA */}
              <motion.button
                onClick={handleSend}
                disabled={!ready || isPending || isConfirming}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {!address
                  ? 'Connect Wallet'
                  : wrongChain
                  ? 'Switch to Arc Testnet'
                  : isPending
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
                  : isConfirming
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Sending…</span>
                  : `Send $${parseFloat(amount || '0').toFixed(2)} USDC`}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
