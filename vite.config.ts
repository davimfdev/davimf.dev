import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// URL do backend local (server/). Em produção o Nginx Proxy Manager é quem
// encaminha /api/ para o container davimf-api, então nada disso vai pro bundle.
const devApiTarget = process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // O vitest 4 não exclui `dist/` sozinho. Sem isto, uma build antiga em
    // server/dist ou dist/ é coletada como suíte e roda o mesmo teste
    // recompilado para CommonJS — que o vitest não consegue importar.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
  optimizeDeps: {
    include: ['lucide-react'],
  },
  server: {
    watch: {
      ignored: ['**/.netlify/**']
    },
    proxy: {
      // Mantém tudo same-origin no dev (sem CORS) e reproduz a topologia de
      // produção: o browser sempre chama /api/... no mesmo host do frontend.
      // changeOrigin: false preserva o Host localhost, que é o que faz os
      // handlers marcarem os cookies como não-Secure fora de produção.
      '/api': {
        target: devApiTarget,
        changeOrigin: false,
      },
    },
  }
});
