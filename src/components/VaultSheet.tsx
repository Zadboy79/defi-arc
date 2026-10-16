import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'

const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!

const spectral = 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)'

const springs = {
  sheet: { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.8 },
}

interface VaultSheetProps {
  mode: 'deposit' | 'withdraw'
  open: boolean
  onClose: () => void
  vaultAddress: `0x${string}` | undefined
  vaultAbi: readonly unknown[]
  onSuccess: () => void
}

export function VaultSheet({ mode, open, onClose, vaultAddress, vaultAbi, onSuccess }: VaultSheetProps) {
  const [amount, setAmount] = useState('')
  const { address, chainId } = useAccount()
  const { switchChain, isPending: switchPending } = useSwitchChain()

  const wrongChain = chainId !== ARC_TESTNET_ID

  // Read wallet USDC balance
  const { data: walletBalance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  // Read vault user balance
  const { data: vaultBalance } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'balances',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!vaultAddress },
  })

  // Read USDC allowance for approve step
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!vaultAddress && mode === 'deposit' },
  })

  // Approve write
  const {
    writeContract: approve,
    data: approveHash,
    isPending: approvePending,
    reset: resetApprove,
  } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Vault action write
  const {
    writeContract: vaultAction,
    data: actionHash,
    isPending: actionPending,
    reset: resetAction,
    isError: actionError,
    error: actionErrorMsg,
  } = useWriteContract()
  const { isLoading: actionConfirming, isSuccess: actionSuccess } = useWaitForTransactionReceipt({ hash: actionHash })

  const parsedAmount = amount && /^\d*\.?\d+$/.test(amount)
    ? (() => { try { return parseAmount(ARC_TESTNET_ID, amount) } catch { return null } })()
    : null

  const displayBalance = (raw: unknown, loading = false) => {
    if (loading) return '...'
    if (raw === undefined || raw === null) return '0.00'
    return Amount.fromRaw(raw as bigint, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
  }

  const maxBalance = mode === 'deposit' ? walletBalance : vaultBalance as bigint | undefined
  const maxFormatted = displayBalance(maxBalance)

  const needsApprove = mode === 'deposit' && parsedAmount && allowance !== undefined
    && (allowance) < parsedAmount.raw

  const handleAction = useCallback(() => {
    if (!parsedAmount || !vaultAddress || !address) return
    if (wrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }

    if (needsApprove) {
      approve({
        address: usdcFact.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [vaultAddress, parsedAmount.raw],
        chainId: ARC_TESTNET_ID,
      })
      return
    }

    vaultAction({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: mode,
      args: [parsedAmount.raw],
      chainId: ARC_TESTNET_ID,
    })
  }, [parsedAmount, vaultAddress, address, wrongChain, needsApprove, mode, vaultAbi, approve, vaultAction, switchChain])

  // After approve confirmed, trigger the actual vault action
  if (approveSuccess && parsedAmount && vaultAddress && !actionPending && !actionConfirming && !actionHash) {
    void refetchAllowance()
  }

  if (actionSuccess && actionHash) {
    toast.success(mode === 'deposit' ? 'Deposited successfully' : 'Withdrew successfully')
    onSuccess()
  }

  if (actionError && actionErrorMsg) {
    const msg = actionErrorMsg?.message?.toLowerCase() || ''
    if (!msg.includes('user rejected')) {
      toast.error('Transaction failed')
    }
  }

  const handleClose = () => {
    setAmount('')
    resetApprove()
    resetAction()
    onClose()
  }

  const isLoading = approvePending || approveConfirming || actionPending || actionConfirming
  const isDone = actionSuccess

  let ctaLabel: React.ReactNode = mode === 'deposit' ? 'Deposit USDC' : 'Withdraw USDC'
  if (wrongChain) ctaLabel = 'Switch to Arc Testnet'
  else if (switchPending) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Switching…</span>
  else if (needsApprove && (approvePending || approveConfirming)) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Approving…</span>
  else if (needsApprove) ctaLabel = 'Approve USDC'
  else if (actionPending) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet…</span>
  else if (actionConfirming) ctaLabel = <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming…</span>

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
            {/* Spectral strip */}
            <div className="h-1" style={{ background: spectral }} />

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>

            <div className="px-5 pb-8 pt-2">
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                  {mode === 'deposit' ? 'Add Money' : 'Cash Out'}
                </h2>
                <button
                  onClick={handleClose}
                  className="flex size-8 items-center justify-center rounded-full"
                  style={{ background: 'rgba(18,45,69,0.08)' }}
                >
                  <X className="size-4" style={{ color: 'var(--ink-2)' }} />
                </button>
              </div>

              {!isDone ? (
                <>
                  {/* Amount input */}
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
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
                      <button
                        onClick={() => maxBalance && setAmount(Amount.fromRaw(maxBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(6))}
                        disabled={!maxBalance}
                        className="text-xs font-semibold disabled:opacity-40"
                        style={{ color: 'var(--accent-hover)' }}
                      >
                        {`Balance: ${maxFormatted} · Max`}
                      </button>
                    </div>
                  </div>

                  {/* Quick chips */}
                  <div className="mb-4 flex gap-2">
                    {['1', '5', '10', '25'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(v)}
                        className="flex-1 rounded-xl py-2 text-xs font-semibold"
                        style={{
                          background: amount === v ? 'var(--accent)' : 'rgba(255,255,255,0.58)',
                          color: amount === v ? 'white' : 'var(--ink-2)',
                          border: '1px solid rgba(255,255,255,0.66)',
                        }}
                      >
                        ${v}
                      </button>
                    ))}
                  </div>

                  {/* Preview row */}
                  {parsedAmount && (
                    <div className="mb-4 rounded-xl px-3 py-2" style={{ background: 'rgba(18,45,69,0.04)' }}>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--muted)' }}>Network fee</span>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>~$0.001 USDC</span>
                      </div>
                      {mode === 'deposit' && (
                        <div className="flex justify-between text-xs mt-1">
                          <span style={{ color: 'var(--muted)' }}>Simulated APY</span>
                          <span className="font-semibold" style={{ color: 'var(--success)' }}>5.0%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    disabled={!parsedAmount || isLoading || !vaultAddress}
                    onClick={handleAction}
                    className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: 'var(--accent)' }}
                  >
                    {ctaLabel}
                  </button>

                  {!vaultAddress && (
                    <p className="mt-2 text-center text-xs" style={{ color: 'var(--subtle)' }}>
                      Contract not yet deployed
                    </p>
                  )}
                </>
              ) : (
                /* Success state */
                <div className="py-4 text-center space-y-3">
                  <div
                    className="mx-auto flex size-12 items-center justify-center rounded-full"
                    style={{ background: 'rgba(26,128,71,0.12)' }}
                  >
                    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--success)' }}>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                    {mode === 'deposit' ? 'Deposited' : 'Withdrawn'}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {amount} USDC {mode === 'deposit' ? 'added to your vault' : 'returned to your wallet'}
                  </p>
                  {actionHash && (
                    <a
                      href={buildTxExplorerUrl(ARC_TESTNET_ID, actionHash)}
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
