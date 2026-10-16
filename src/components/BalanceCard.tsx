import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { TrendingUp, Wallet } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { getUsdc, buildAddressExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

const ARC_TESTNET_ID = 5042002

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
}

const usdcFact = getUsdc(ARC_TESTNET_ID)!

interface BalanceCardProps {
  vaultBalance: bigint | undefined
  vaultLoading: boolean
}

export function BalanceCard({ vaultBalance, vaultLoading }: BalanceCardProps) {
  const { address, isConnected } = useAccount()

  const { data: walletBalance, isLoading: walletLoading } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const formatUsdc = (raw: bigint | undefined, loading: boolean) => {
    if (loading) return '...'
    if (raw === undefined) return '—'
    return Amount.fromRaw(raw, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
  }

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      <div className="mb-4 flex items-center gap-2">
        <TokenUSDC variant="branded" size={20} />
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
          Arc Testnet · USDC
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Wallet balance */}
        <div
          className="rounded-2xl p-3"
          style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
        >
          <div className="mb-1 flex items-center gap-1">
            <Wallet className="size-3" style={{ color: 'var(--subtle)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
              Wallet
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {isConnected ? formatUsdc(walletBalance, walletLoading) : '—'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </div>
        </div>

        {/* Vault balance */}
        <div
          className="rounded-2xl p-3"
          style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
        >
          <div className="mb-1 flex items-center gap-1">
            <TrendingUp className="size-3" style={{ color: 'var(--success)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
              Vault
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {isConnected ? formatUsdc(vaultBalance, vaultLoading) : '—'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </div>
        </div>
      </div>

      {address && (
        <a
          href={buildAddressExplorerUrl(ARC_TESTNET_ID, address)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-xs font-mono tabular-nums truncate"
          style={{ color: 'var(--subtle)' }}
        >
          {address.slice(0, 10)}…{address.slice(-8)}
        </a>
      )}
    </section>
  )
}
