import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monkey from 'vite-plugin-monkey'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // 内联小于 300KB 的资源为 base64
    assetsInlineLimit: 300 * 1024,
  },
  plugins: [
    react(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: '88code 助手',
        namespace: 'https://github.com/authwang',
        version: '1.0.0',
        description: '88code.ai 助手：服务状态整合、自动刷新、定时重置',
        author: 'authwang',
        match: ['https://www.88code.ai/*', 'https://88code.ai/*'],
        icon: 'https://www.88code.ai/assets/logo-BCIlXRt9.png',
        homepage: 'https://github.com/Waasaabii/88tools',
        supportURL: 'https://github.com/Waasaabii/88tools/issues',
        updateURL: 'https://github.com/Waasaabii/88tools/releases/latest/download/88tools.user.js',
        downloadURL: 'https://github.com/Waasaabii/88tools/releases/latest/download/88tools.user.js',
        grant: [
          'GM_setValue',
          'GM_getValue',
          'GM_notification',
        ],
        'run-at': 'document-end',
      },
      build: {
        // React 19 没有 UMD 构建，必须打包进脚本
        externalGlobals: {},
      },
    }),
  ],
})
