export default defineNuxtConfig({
  devServer: {
    host: "0",
    port: 3000,
  },
  server: {
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/main.css", "~/assets/css/stylesheet.css"],
  nitro: {
    externals: {
      trace: false,
    },
  },
  typescript: {
    tsConfig: {
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        module: "ESNext",
        moduleResolution: "node",
        target: "ESNext",
        sourceMap: true,
        outDir: "dist",
        noUncheckedIndexedAccess: false,
      },
    },
  },
});
