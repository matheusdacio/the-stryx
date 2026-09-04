import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Cacheia o app inteiro (não só os dados do Firestore) pra abrir sem
    // sinal no ensaio. manifest: false porque public/manifest.webmanifest
    // já existe e já está linkado no index.html. importScripts embute o SW
    // do FCM no SW gerado — um só arquivo, registrado em useNotifications.js
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        importScripts: ['firebase-messaging-sw.js'],
        navigateFallback: '/the-stryx/index.html',
      },
    }),
  ],
  base: '/the-stryx/',
})
