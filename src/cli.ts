import 'dotenv/config';
import { getProvider } from './providers/index.js';
import { runPipeline } from './pipeline/run.js';

const brief = process.argv.slice(2).join(' ');

if (!brief) {
  console.error('Usage: npm run gen -- "<brief>"');
  process.exit(1);
}

const provider = getProvider(process.env.PROVIDER ?? 'claude');
const result = await runPipeline(provider, { brief });

console.log(result.text);
console.error('\n---');
console.error(JSON.stringify(result.summary, null, 2));
