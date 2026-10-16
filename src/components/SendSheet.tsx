import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'

const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!

const spectral = 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)'
const springs = { sheet: { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.8 } }

interface SendSheetProps {
  open: boolean
  onClose: () => void
}

export function SendSheet({ open, onClose }: SendSheetProps) {
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const { address, chainId } = useAccount()
  const { switchChain, isPending: switchPending } = useSwitchChain()

  const wrongChain = chainId !== ARC_TESTNET_ID

  const { data: walletBalance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const {
    writeContract: transfer,
    data: txHash,
    isPending,
    reset,
    isError,
    error,
  } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const parsedAmount = amount && /^\d*\.?\d+$/.test(amount)
    ? (() => { try { return parseAmount(ARC_TESTNET_ID, amount) } catch { return null } })()
    : null

  const validRecipient = recipient && isAddress(recipient)

  const handleSend = useCallback(() => {
    if (!parsedAmount || !validRecipient) return
    if (wrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }

    transfer({
      address: usdcFact.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, parsedAmount.raw],
      chainId: ARC_TESTNET_ID,
    })
  }, [parsedAmount, validRecipient, wrongChain, recipient, transfer, switchChain])

  if (isSuccess && txHash) {
    toast.success('Sent successfully')
  }

  if (isError && error) {
    const msg = error?.message?.toLowerCase() || ''
    if (!msg.includes('user rejected')) {
      toast.error('Send failed')
    }
  }

  const handleClose = () => {
    setAmount('')
    setRecipient('')
    reset()
    onClose()
  }

  const isLoading = isPending || isConfirming

  let ctaLabel: React.ReactNode = 'Send USDC'
  if (wrongChain) ctaLabel = 'Switch to Arc Testnet'
  else if (switchPending) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Switching…</span>
  else if (isPending) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet…</span>
  else if (isConfirming) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming…</span>

  const maxFormatted = walletBalance
    ? Amount.fromRaw(walletBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : '0.00'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <motion.section
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl"
            style={{
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springs.sheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1" style={{ background: spectral }} />
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>

            <div className="px-5 pb-8 pt-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Send USDC</h2>
                <button
                  onClick={handleClose}
                  className="flex size-8 items-center justify-center rounded-full"
                  style={{ background: 'rgba(18,45,69,0.08)' }}
                >
                  <X className="size-4" style={{ color: 'var(--ink-2)' }} />
                </button>
              </div>

              {!isSuccess ? (
                <>
                  {/* Recipient */}
                  <div
                    className="rounded-2xl px-4 py-3 mb-3"
                    style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
                  >
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--subtle)' }}>
                      Recipient address
                    </label>
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value.trim())}
                      placeholder="0x…"
                      className="mono w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-300"
                      style={{ color: 'var(--ink)' }}
                    />
                  </div>

                  {/* Amount */}
                  <div
                    className="rounded-2xl p-4 mb-3"
                    style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
                  >
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, '')
                        if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                      }}
                      placeholder="0.00"
                      className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                      style={{ color: 'var(--ink)' }}
                    />
                    <div className="mt-2 flex justify-between">
                      <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
                      <button
                        onClick={() => walletBalance && setAmount(Amount.fromRaw(walletBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(6))}
                        disabled={!walletBalance}
                        className="text-xs font-semibold disabled:opacity-40"
                        style={{ color: 'var(--accent-hover)' }}
                      >
                        {`Balance: ${maxFormatted} · Max`}
                      </button>
                    </div>
                  </div>

                  <button
                    disabled={!parsedAmount || !validRecipient || isLoading}
                    onClick={handleSend}
                    className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: 'var(--accent)' }}
                  >
                    {ctaLabel}
                  </button>
                </>
              ) : (
                <div className="py-4 text-center space-y-3">
                  <div
                    className="mx-auto flex size-12 items-center justify-center rounded-full"
                    style={{ background: 'rgba(26,128,71,0.12)' }}
                  >
                    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--success)' }}>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Sent</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {amount} USDC sent to {recipient.slice(0, 6)}…{recipient.slice(-4)}
                  </p>
                  {txHash && (
                    <a
                      href={buildTxExplorerUrl(ARC_TESTNET_ID, txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: 'var(--accent-hover)' }}
                    >
                      View on ArcScan <ExternalLink className="size-3" />
                    </a>
                  )}
                  <button
                    onClick={handleClose}
                    className="w-full rounded-2xl py-3 text-sm font-semibold"
                    style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--ink-2)' }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
