/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Suppress missing optional peer dependency warnings from WalletConnect/MetaMask SDK
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
