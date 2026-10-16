import { useReadContract } from 'wagmi'
import { TrendingUp, Users, BarChart2 } from 'lucide-react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

const ARC_TESTNET_ID = 5042002

interface StatsBarProps {
  vaultAddress: `0x${string}` | undefined
  vaultAbi: readonly unknown[]
}

export function StatsBar({ vaultAddress, vaultAbi }: StatsBarProps) {
  const { data: totalDeposited, isLoading: totalLoading } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'totalDeposited',
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!vaultAddress, refetchInterval: 10_000 },
  })

  const fmt = (raw: unknown, loading: boolean) => {
    if (loading || !vaultAddress) return '...'
    if (raw === undefined || raw === null) return '0.00'
    return Amount.fromRaw(raw as bigint, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
  }

  const stats = [
    { icon: BarChart2, label: 'Total Deposited', value: `$${fmt(totalDeposited, totalLoading)}` },
    { icon: TrendingUp, label: 'Simulated APY', value: '5.0%' },
    { icon: Users, label: 'Network', value: 'Arc Testnet' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="rounded-2xl p-3 text-center"
          style={{
            background: 'rgba(255,255,255,0.46)',
            border: '1px solid rgba(255,255,255,0.56)',
          }}
        >
          <div className="mb-1 flex justify-center">
            <Icon className="size-4" style={{ color: 'var(--muted)' }} />
          </div>
          <div className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {value}
          </div>
          <div className="text-xs" style={{ color: 'var(--subtle)' }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
