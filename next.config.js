/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      'ioredis',
      'bullmq',
      'pdfkit',
      'minio',
      'nodemailer',
      'dns',
      'pdfjs-dist',
      'tesseract.js',
      '@napi-rs/canvas',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude server-only packages from webpack bundling
      const serverOnlyPackages = ['ioredis', 'bullmq', 'pdfkit', 'minio', '@aws-sdk'];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ...serverOnlyPackages,
      ];
    }
    // Handle node: protocol
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      'diagnostics_channel': false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
