# Arc DeFi — USDC Vault

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app.

---

## What This App Does

A full-stack USDC DeFi app on Arc Testnet. Users can deposit USDC into a vault, earn simulated 5% APY yield, withdraw at any time, and send USDC to any address. Built on Arc where USDC is the native gas token.

## Deployed Contracts

| Contract    | Address                                      | Chain        | Explorer |
|-------------|----------------------------------------------|--------------|---------|
| UsdcVault   | 0x74b2e84aa55763ee0d4d4e216df780d035eafb59   | Arc Testnet  | https://explorer.testnet.arc.io/address/0x74b2e84aa55763ee0d4d4e216df780d035eafb59 |

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
