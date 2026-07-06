module.exports = {
  apps: [
    {
      name: 'lms-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'lms-worker',
      script: 'src/jobs/worker-runner.js',
      interpreter: 'node',
      cwd: './',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '2G',  // Tăng từ 512M: 2 FFmpeg đồng thời cần ~400-800MB
      kill_timeout: 30000,       // Cho graceful shutdown 30s trước khi force-kill
    },
  ],
};
