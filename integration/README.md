# Live adapter tests

The unit tests in `packages/adapters` use recorded responses. These tests run the adapters
against **real** providers and make **real payments**, on a local Bitcoin regtest network that
runs in Docker. Regtest coins are created locally and have no value; nothing here touches mainnet
or testnet, and every key it creates only works on this throwaway network.

| Adapter  | Provider in the stack                           | Covered                                                                                      |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| LNbits   | LNbits 1.7 on LND                               | paid (with preimage), expired, expiry after restart, bad key                                 |
| BTCPay   | BTCPay Server 2.4 with NBXplorer and LND        | Lightning paid, on-chain confirming → paid, underpaid, overpaid, expired, cancel permissions |
| NWC      | Alby Hub 1.10 on LND, local Nostr relay         | paid (with preimage), expired, receive-only connection can't spend                           |
| OpenNode | dev API (testnet), only with `OPENNODE_API_KEY` | charge shape and status                                                                      |

A second LND node plays the customer's wallet and pays the invoices over a real channel; the
bitcoind wallet pays on-chain invoices.

## Run

Needs Docker (about 2 GB of RAM) and Node 22.23+.

```sh
pnpm integration:up     # start the stack, open a channel, configure every provider
pnpm integration:test   # build the adapters and run integration/live.test.ts
pnpm integration:down   # stop everything and delete the regtest data
```

`integration:up` is safe to re-run. It writes the regtest keys to `integration/.env.integration`
(git-ignored). Local ports: LNbits 5101, BTCPay 5102, Alby Hub 5103, relay 5104.

To include OpenNode, create an API key with invoice permissions at
<https://app.dev.opennode.com> (testnet) and run with `OPENNODE_API_KEY=… pnpm integration:test`.

CI runs this weekly and on pull requests that touch the adapters
(`.github/workflows/integration.yml`).

## What these tests found

- **LNbits 1.x never reports `expired`.** An expired invoice comes back as `status: "failed"`
  with an `"expired"` label, and `details.expiry` is an ISO date, not a number. The adapter only
  knew an invoice had expired if the same instance created it, so after a server restart a
  checkout would wait forever. Fixed in `lnbits.ts`.
- **LNbits answers an unknown API key with 404** ("Wallet not found"), not 401.
- **BTCPay `cancel()` needs `btcpay.store.canmanageinvoicestatus`**, which the docs didn't
  mention. The two documented permissions are enough for everything the components do; the
  guide now says when to add the third.
