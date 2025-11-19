import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Импортируем 'path'

// https://vitejs.dev/config/
export default defineConfig({
  //
  // --- КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ ---
  // Явно указываем, что корень проекта (где лежит index.html) 
  // находится в той же папке, что и этот конфиг.
  //
  root: path.resolve(process.cwd()), 
  //
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
  //
  plugins: [react()],
  server: {
    // Эта опция помогает, если возникают проблемы с путями
    fs: {
      strict: false 
    }
  }
})