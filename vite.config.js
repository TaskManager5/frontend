import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.resolve(process.cwd()),
  plugins: [react()],
  server: {
    fs: {
      strict: false
    }
  },
  preview: {
    allowedHosts: [
      'taskmanager.dmz.vmmb.pstu.ru',
      '172.30.0.35',
      'localhost',
      '127.0.0.1'
    ]
  }
})
