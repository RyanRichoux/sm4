// Counts FAILED sign-ins only. A successful sign-in clears the count for that
// email, so normal use never locks anyone out. In-memory: fine for one server.

interface Bucket {
  failures: number;
  resetAt: number;
}

export class LoginLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxPerEmail: number,
    private readonly windowMs = 15 * 60_000,
    private readonly maxPerIp = maxPerEmail * 5,
  ) {}

  private keys(ip: string, email: string): [string, number][] {
    return [
      [`e|${ip}|${email}`, this.maxPerEmail],
      [`i|${ip}`, this.maxPerIp],
    ];
  }

  /** True if this IP/email pair has used up its failed attempts. */
  isBlocked(ip: string, email: string, now = Date.now()): boolean {
    return this.keys(ip, email).some(([k, max]) => {
      const b = this.buckets.get(k);
      return !!b && b.resetAt > now && b.failures >= max;
    });
  }

  recordFailure(ip: string, email: string, now = Date.now()): void {
    if (this.buckets.size > 10_000) this.sweep(now);
    for (const [k] of this.keys(ip, email)) {
      const b = this.buckets.get(k);
      if (!b || b.resetAt <= now) this.buckets.set(k, { failures: 1, resetAt: now + this.windowMs });
      else b.failures += 1;
    }
  }

  recordSuccess(ip: string, email: string): void {
    this.buckets.delete(`e|${ip}|${email}`);
  }

  private sweep(now: number): void {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}
