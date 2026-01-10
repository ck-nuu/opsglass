/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/ui", "@repo/database", "@repo/core"],
};

export default nextConfig;
