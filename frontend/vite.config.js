import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  // Optimisations de build
  build: {
    // Taille limite des chunks (en KB)
    chunkSizeWarningLimit: 1000,
    
    // Configuration du code splitting
    rollupOptions: {
      output: {
        // Séparation des vendors
        manualChunks: {
          // Librairies React
          'react-vendor': ['react', 'react-dom'],
          
          // Librairies d'icônes
          'icons-vendor': ['lucide-react'],
          
          // Librairies utilitaires
          'utils-vendor': ['axios']
        },
        
        // Nommage des chunks
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId 
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.jsx', '').replace('.js', '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        }
      }
    },
    
    // Optimisations de minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // Supprimer les console.log en production
        drop_console: true,
        drop_debugger: true,
      },
    },
    
    // Source maps pour le debugging
    sourcemap: false, // Désactivé en production pour réduire la taille
  },
  
  // Optimisations de développement
  server: {
    // Hot Module Replacement optimisé
    hmr: {
      overlay: true
    }
  },
  
  // Optimisations des dépendances
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'axios'
    ]
  }
})
