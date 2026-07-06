# 🟥 Docker-Baymax 🤖

> "Hello, I am Baymax, your personal container-health companion."

`docker-baymax` is a lightweight, platform-agnostic, zero-dependency self-healing daemon written in native Node.js. It operates silently in the background of your edge hardware (like a Raspberry Pi or home server) to dynamically discover, monitor, and autonomously recover crashed or dropped Docker microservices.

Instead of introducing heavy third-party container orchestration footprints or complex corporate tooling, Docker-Baymax interfaces directly with the host engine to ensure infrastructure resilience through custom event-driven scripting.

---

## 🛠️ Core Engineering Features

*   **Dynamic Container Discovery**: Zero hardcoded setups. Baymax scans the system state to dynamically register and monitor new workloads within 30 seconds of launch.
*   **State-Machine Comparison**: Leverages an internal memory cache (`Map`) to compare current container states against historical data. This prevents aggressive restarts on containers you intentionally choose to stop.
*   **Exponential Backoff Mitigation**: If a container enters a catastrophic crash-loop, Baymax automatically throttles recovery attempts ($2^{\text{retries}} \times 1000$ ms) to prevent high CPU utilization and resource starvation.
*   **Quarantine Safeguard**: Implements an automated isolation threshold. If a microservice fails 3 consecutive restart cycles, it is gracefully quarantined, freezing automated attempts until manual intervention occurs.
*   **Zero External Dependencies**: Bypasses heavy framework footprints. Baymax queries the native Linux Docker Engine API securely over the local Unix socket (`/var/run/docker.sock`) using vanilla Node.js HTTP architectures.

---

## 🏗️ Architecture & How It Works

Rather than parsing messy, resource-intensive CLI terminal shell strings (`docker ps`), Baymax handles internal I/O asynchronously via streaming Unix sockets:

```
[ Docker-Baymax Daemon ]
│
├─── (Query UNIX Socket HTTP REST) ───> [/var/run/docker.sock]
│                                               │
│<───────────────── (State Matrix Payload JSON) ┘
│
├─── [ Evaluate Current vs. Cached State ]
│
├─── [ Pass State Change: Update Cache ]
│
└─── [ Fail State Change: Execute Backoff / Self-Healing Trigger ]
```

## 🚀 Getting Started (Headless / Server Setup)

### 1. Installation
Clone the architecture into your local directory:

``` bash
mkdir ~/docker-baymax && cd ~/docker-baymax
npm init -y
npm pkg set type="module"
```

Ensure your system script (`monitor.js`) is inside the working directory.

### 2. Live Execution
Because Baymax requires authorization to access the root Docker system pipe, execute with proper socket privileges:

```bash
sudo node monitor.js
```

### 3. Production Deployment (PM2 Daemon)
To ensure your companion runs 24/7 as a background service and survives system restarts:

```bash
npm install -g pm2
pm2 start monitor.js --name "docker-baymax"
pm2 save
pm2 startup
```

---

## 💼 SRE / Resiliency Showcase

This project was built to simulate enterprise-grade Site Reliability Engineering (SRE) logic on localized bare-metal deployments. It emphasizes clean memory collection (cache purging on container deletion), safe error handling, asynchronous event concurrency, and failure mitigation patterns.
