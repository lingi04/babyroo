// Run on an external scheduler at least once per minimum configured interval.
// No dotenv loading: inject deployment secrets through the scheduler environment.
async function main() {
  const base = process.env.BABYROO_CROWDING_API_BASE_URL;
  const secret = process.env.BABYROO_CROWDING_JOB_SECRET;
  if (!base || !secret || secret.length < 32)
    throw new Error('Collector environment is incomplete');
  const url = new URL(base.replace(/\/$/, '') + '/internal/crowding/collect');
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Use an HTTPS API base URL');
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: 'Bearer ' + secret },
  });
  if (!response.ok)
    throw new Error('Collector request failed with status ' + response.status);
  const result = await response.json();
  console.log(
    JSON.stringify({
      attempted: result.attempted,
      completed: result.completed,
      failed: result.failed,
      skipped: result.skipped,
    }),
  );
  if (result.failed > 0) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    'Crowding collection failed; check scheduler configuration and server health.',
  );
  process.exitCode = 1;
});
