import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { TrendingUp, Loader2 } from 'lucide-react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

const ARC_TESTNET_ID = 5042002

interface YieldCardProps {
  vaultAddress: `0x${string}` | undefined
  vaultAbi: readonly unknown[]
  onSuccess: () => void
}

export function YieldCard({ vaultAddress, vaultAbi, onSuccess }: YieldCardProps) {
  const { address, chainId } = useAccount()
  const { switchChain, isPending: switchPending } = useSwitchChain()
  const wrongChain = chainId !== ARC_TESTNET_ID

  // Read user deposited balance (to show yield is accruing)
  const { data: userBalance } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'balances',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!vaultAddress },
  })

  // Compute pending simulated yield (read-only, no gas)
  const { data: pendingYield } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pendingYield',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!vaultAddress, refetchInterval: 5_000 },
  })

  const { writeContract: claimYield, data: claimHash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  const fmtUsdc = (raw: unknown) => {
    if (raw === undefined || raw === null) return '0.000000'
    return Amount.fromRaw(raw as bigint, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(6)
  }

  const hasDeposit = userBalance !== undefined && (userBalance as bigint) > 0n
  const hasPendingYield = pendingYield !== undefined && (pendingYield as bigint) > 0n

  const handleClaim = () => {
    if (!vaultAddress || !address) return
    if (wrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    claimYield({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: 'claimYield',
      args: [],
      chainId: ARC_TESTNET_ID,
    })
  }

  if (isSuccess) {
    toast.success('Yield claimed')
    onSuccess()
    reset()
  }

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        background: 'rgba(255,255,255,0.64)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.68)',
        boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="flex size-5 items-center justify-center rounded-md"
            style={{ background: 'rgba(26,128,71,0.12)' }}
          >
            <TrendingUp className="size-3" style={{ color: 'var(--success)' }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Simulated Yield · 5% APY
          </span>
        </div>
        {hasDeposit && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}>
            Accruing
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {fmtUsdc(pendingYield)}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC pending</span>
      </div>

      {!hasDeposit && (
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Deposit USDC to start earning simulated yield.
        </p>
      )}

      {isSuccess && claimHash && (
        <div
          className="mb-3 rounded-xl px-3 py-2"
          style={{ background: 'rgba(26,128,71,0.06)' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--success)' }}>Claimed</span>
            <a
              href={buildTxExplorerUrl(ARC_TESTNET_ID, claimHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: 'var(--accent-hover)' }}
            >
              View <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      <button
        disabled={!hasPendingYield || isPending || isConfirming || switchPending || !vaultAddress}
        onClick={handleClaim}
        className="w-full rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}
      >
        {isPending || isConfirming || switchPending
          ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> {isPending ? 'Confirm…' : isConfirming ? 'Confirming…' : 'Switching…'}</span>
          : 'Claim Yield'}
      </button>
    </div>
  )
}
