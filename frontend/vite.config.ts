import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 确保 KaTeX 字体和 CSS 被正确处理
    assetsInlineLimit: 0,
  },
})
