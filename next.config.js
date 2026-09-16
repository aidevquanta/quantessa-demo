/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ["pdf-parse", "mammoth"],
  webpack: (config) => {
    // Avoid writing the webpack persistent cache to keep disk usage low.
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;