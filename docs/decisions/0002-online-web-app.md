# 0002 — Event night is a plain web app, no venue server, no offline mode

**Decision:** event night runs against the home server over the venue's internet or a phone hotspot. Short drops are handled by queuing changes on the device and replaying them exactly once (idempotent writes keyed by client-generated ids).

**Rejected:** a venue laptop running its own copy (checkout/check-in). It removed the internet dependency but added setup steps and sync risk. Simplicity wins.
