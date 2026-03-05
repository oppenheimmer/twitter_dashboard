import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  env: {
    ARCHIVE_ROOT: path.resolve(__dirname, '..', 'zip'),
  },
}

export default nextConfig
