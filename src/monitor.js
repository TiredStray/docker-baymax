import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const CHECK_INTERVAL = 30000; // Scan every 30 seconds
const MAX_RETRIES = 3;        // Give up after 3 consecutive failures

const containerCache = new Map();

function queryDockerSocket(path) {
    return new Promise((resolve, reject) => {
        const options = { socketPath: '/var/run/docker.sock', path, method: 'GET' };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject(new Error(`Status ${res.statusCode}`)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function monitorContainers() {
    console.log(`\n[${new Date().toISOString()}] Scanning Docker Engine...`);

    try {
        const currentContainers = await queryDockerSocket('/containers/json?all=1');
        const activeIdsThisRun = new Set();
        const now = Date.now();

        for (const container of currentContainers) {
            const id = container.Id;
            const name = container.Names?.replace(/^\//, '') || 'unknown';
            const state = container.State;

            activeIdsThisRun.add(id);

            // 1. Initial Discovery
            if (!containerCache.has(id)) {
                containerCache.set(id, {
                    name,
                    lastKnownState: state,
                    retryCount: 0,
                    nextAllowedAttempt: 0,
                    quarantined: false
                });
                console.log(`📦 DISCOVERED: "${name}" (${id.substring(0, 12)}). State: ${state.toUpperCase()}`);
                continue;
            }

            const cached = containerCache.get(id);

            // If the container recovered on its own or was manually fixed, reset throttling
            if (state === 'running' && cached.lastKnownState !== 'running') {
                console.log(`🔄 RECOVERED: "${name}" is back online. Resetting backoff counters.`);
                cached.retryCount = 0;
                cached.nextAllowedAttempt = 0;
                cached.quarantined = false;
                cached.lastKnownState = 'running';
                continue;
            }

            // 2. Self-Healing Logic (Fires if it dropped unexpectedly)
            if (cached.lastKnownState === 'running' && state !== 'running') {

                if (cached.quarantined) {
                    console.warn(`⏳ SKIPPING: "${name}" is CRASH-LOOPING and quarantined. Manual intervention required.`);
                    continue;
                }

                if (now < cached.nextAllowedAttempt) {
                    console.log(`⏱️ THROTTLED: Backoff active for "${name}". Waiting before next restart.`);
                    continue;
                }

                if (cached.retryCount >= MAX_RETRIES) {
                    cached.quarantined = true;
                    console.error(`🚨 QUARANTINED: "${name}" failed ${MAX_RETRIES} consecutive restarts. Disabling self-healing for this container.`);
                    continue;
                }

                // Trigger Exponential Backoff
                cached.retryCount++;
                const backoffDelay = Math.pow(2, cached.retryCount) * 1000; // 2s, 4s, 8s...
                cached.nextAllowedAttempt = now + backoffDelay;

                console.error(`🚨 ALERT: "${name}" dropped to ${state.toUpperCase()}! Restart attempt ${cached.retryCount}/${MAX_RETRIES} (Backoff: ${backoffDelay / 1000}s)`);

                try {
                    const { stdout } = await execAsync(`docker restart ${id}`);
                    console.log(`✅ SUCCESS: Restart signal sent to "${name}".`);
                    // Note: Leave lastKnownState as 'running' so we can catch if it crashes again immediately
                } catch (restartErr) {
                    console.error(`❌ FAILURE: Could not restart "${name}":`, restartErr.message);
                }
            } else {
                // Track normal state changes (e.g. manual stops)
                cached.lastKnownState = state;
            }
        }

        // Cache Cleanup for deleted containers
        for (const cachedId of containerCache.keys()) {
            if (!activeIdsThisRun.has(cachedId)) {
                containerCache.delete(cachedId);
            }
        }

    } catch (error) {
        console.error('💥 Monitor Error:', error.message);
    }
}

setInterval(monitorContainers, CHECK_INTERVAL);
monitorContainers();
