# 0003 — Remote access through Tailscale

**Decision:** the app listens on 127.0.0.1 only. Staff reach it through `tailscale serve` (HTTPS on the tailnet). From Phase 1, only the public view paths (audience screen, fighter view) are published through Tailscale Funnel.

**Why:** staff screens are never on the public internet; no open router ports; no domain to buy.
