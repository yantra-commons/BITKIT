---
'@orange-ui/adapters': patch
---

LNbits: detect expired invoices from LNbits 1.x responses (`status: "failed"` with an `expired` label, ISO `details.expiry`), so status is correct even when a different adapter instance created the invoice (for example after a server restart). Found by the new live adapter tests against a real LNbits.
