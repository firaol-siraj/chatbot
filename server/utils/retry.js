function isRateLimit(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit') || err?.status === 429;
}

export async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < maxRetries && isRateLimit(err)) {
        const wait = 35000; // 35 sec - API suggests ~32s on 429
        console.log(`Rate limited, waiting ${wait / 1000}s before retry ${i + 1}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}
