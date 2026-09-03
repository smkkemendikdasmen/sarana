// PM2 Ecosystem — SARANASMK Enterprise Blue/Green Canary Deploy
// 4 slots: api-blue :4000 | api-green :4001 (canary) | web-blue :3000 | web-green :3001 (canary)
// Canary step order: 1% → 10% → 50% → 100% traffic shift. Health threshold 95% 5xx rate.
// Below threshold rollback within 60s.
//
// Deploy CANARY:            pm2 start ecosystem.config.js --only api-green,web-green
// Scale canary instances:   pm2 scale api-green <N>   (N from 1→10→50→100% of blue instances)
// Health check:             curl -sfo /dev/null -w "%{http_code}\n" http://127.0.0.1:<PORT>/health
// Promote GREEN → BLUE:     pm2 stop api-blue && pm2 delete api-blue && pm2 restart api-green --name api-blue
// Rollback (green bad):     pm2 delete api-green web-green   (keep blue serving)
//
// Persist after configure:  pm2 save

const CPU = parseInt(process.env.PM2_CPU ?? String(Math.max(2, Math.min(require("os").cpus().length, 8))));
const BLUE_INST = parseInt(process.env.PM2_BLUE_INST ?? String(Math.min(CPU, 4)));
const GREEN_CANARY_START = parseInt(process.env.PM2_GREEN_START ?? "1");

const COMMON_API = {
  cwd: "./apps/api",
  script: "dist/main.js",
  listen_timeout: 15000,
  kill_timeout: 10000,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 5000,
  exp_backoff_restart_delay: 500,
  watch: false,
  ignore_watch: ["node_modules", ".git", "logs", "dist", ".next"],
  env: {
    NODE_ENV: "production",
    TZ: "Asia/Jakarta",
    CLS_ENABLED: "1",
    RLS_ENABLED: "1",
  },
  merge_logs: true,
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  output: "../../logs/api-%n-out.log",
  error: "../../logs/api-%n-err.log",
  pid_file: "../../logs/api-%n.pid",
  max_memory_restart: "900M",
  node_args: ["--max-old-space-size=900"],
};

const COMMON_WEB = {
  cwd: "./apps/web",
  script: "node_modules/next/dist/bin/next",
  args: "start",
  wait_ready: true,
  listen_timeout: 20000,
  kill_timeout: 15000,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 7000,
  exp_backoff_restart_delay: 700,
  watch: false,
  ignore_watch: ["node_modules", ".git", "logs", ".next"],
  env: {
    NODE_ENV: "production",
    TZ: "Asia/Jakarta",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  merge_logs: true,
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  output: "../../logs/web-%n-out.log",
  error: "../../logs/web-%n-err.log",
  pid_file: "../../logs/web-%n.pid",
  max_memory_restart: "1400M",
  node_args: ["--max-old-space-size=1400"],
};

module.exports = {
  apps: [
    // ===========================================
    // API BLUE (LIVE STABLE default slot port 4000)
    // ===========================================
    {
      ...COMMON_API,
      name: "api-blue",
      instances: BLUE_INST,
      exec_mode: "cluster",
      port: undefined,
      env: {
        ...COMMON_API.env,
        PORT: "4000",
        SLOT: "blue",
      },
    },
    // ===========================================
    // API GREEN (CANARY slot port 4001 — scale 1→10→50→100%)
    // ===========================================
    {
      ...COMMON_API,
      name: "api-green",
      instances: GREEN_CANARY_START,
      exec_mode: "cluster",
      env: {
        ...COMMON_API.env,
        PORT: "4001",
        SLOT: "green",
        CANARY: "1",
      },
    },

    // ===========================================
    // WEB BLUE (LIVE STABLE default slot port 3000)
    // ===========================================
    {
      ...COMMON_WEB,
      name: "web-blue",
      instances: BLUE_INST,
      exec_mode: "cluster",
      env: {
        ...COMMON_WEB.env,
        PORT: "3000",
        SLOT: "blue",
      },
    },
    // ===========================================
    // WEB GREEN (CANARY slot port 3001)
    // ===========================================
    {
      ...COMMON_WEB,
      name: "web-green",
      instances: GREEN_CANARY_START,
      exec_mode: "cluster",
      env: {
        ...COMMON_WEB.env,
        PORT: "3001",
        SLOT: "green",
        CANARY: "1",
      },
    },
  ],

  // ====================================================================
  // DEPLOY CANARY FLOW — invokable via: pm2 deploy ecosystem.config.js production
  // Manual `deploy_canary.sh` handles: build → start green → health → scale → promote/rollback
  // ====================================================================
  deploy: {
    production: {
      user: "alatprods",
      host: "103.160.202.73",
      ref: "origin/main",
      repo: "git@github.com:prisma/saranasmk.git",
      path: "/home/alatprods/saranasmk",
      "pre-deploy": "git fetch --all --tags",
      "post-deploy":
        "mkdir -p logs && npm ci --omit=dev && cd apps/api && npm ci --omit=dev && npm run build && cd ../web && npm ci --omit=dev && npm run build && cd ../.. && bash ./deploy_canary.sh",
    },
  },
};
