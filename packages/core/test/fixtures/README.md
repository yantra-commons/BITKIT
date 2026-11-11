# Test fixtures

- `bolt11-invoice-test.json` — verbatim copy of
  [lightning/bolts `bolt11/invoice-test.json`](https://github.com/lightning/bolts/blob/master/bolt11/invoice-test.json)
  (CC-BY 4.0). Vectors #25 and #30 require secp256k1 signature verification, which the
  display-level decoder intentionally does not perform (see `SECURITY.md`).
- BIP-173 / BIP-350 address vectors and BIP-21 examples are inlined in the test files, copied
  from the BIP texts.
