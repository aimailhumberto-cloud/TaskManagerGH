/** @type {import('next').NextConfig} */
module.exports = {
  webpack(config, { isServer }) {
    // reqLang usa AsyncLocalStorage (solo existe en el servidor); en el navegador esa pieza se omite y tr() lee el idioma de la pantalla.
    if (!isServer) config.resolve.fallback = { ...(config.resolve.fallback || {}), async_hooks: false };
    return config;
  },
};
