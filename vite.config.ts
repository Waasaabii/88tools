import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monkey from 'vite-plugin-monkey'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: '88code 增强助手',
        namespace: 'https://github.com/authwang',
        version: '1.0.0',
        description: '88code.ai 增强功能：服务状态整合、自动刷新、定时重置',
        author: 'authwang',
        match: ['https://www.88code.ai/*', 'https://88code.ai/*'],
        icon: 'https://www.88code.ai/assets/logo-BCIlXRt9.png',
        grant: [
          'GM_setValue',
          'GM_getValue',
          'GM_notification',
        ],
        'run-at': 'document-end',
      },
      build: {
        externalGlobals: {
          react: ['React', 'https://unpkg.com/react@19/umd/react.production.min.js'],
          'react-dom': ['ReactDOM', 'https://unpkg.com/react-dom@19/umd/react-dom.production.min.js'],
        },
      },
    }),
  ],
})
