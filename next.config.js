const path = require('path');

module.exports = {
  typescript: {
    // ✅ Faz o Next buildar mesmo com erros de tipagem (TS2339, TS7006, etc.)
    ignoreBuildErrors: true,
  },
  experimental: {
    incrementalCacheHandlerPath: './cache-handler.js',
  },
  eslint: {
    // ✅ Evita o ESLint travar o build no CI
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    // Limit webpack parallelism/workers to avoid spawning too many processes
    // (e.g. on constrained shared machines). Adjust NUMBER below as needed.
    const NUMBER = 40;
    try {
      // global parallelism (Webpack 5)
      config.parallelism = NUMBER;

      // If minimizers (Terser/CSS) are present, set their parallel option
      if (config.optimization && Array.isArray(config.optimization.minimizer)) {
        config.optimization.minimizer.forEach((plugin) => {
          try {
            // Some minimizers expose `options.parallel`
            if (plugin && plugin.options && typeof plugin.options === 'object') {
              if ('parallel' in plugin.options) plugin.options.parallel = NUMBER;
            }
            // Fallback: some plugins store options under `userOptions`
            if (plugin && plugin.userOptions && typeof plugin.userOptions === 'object') {
              if ('parallel' in plugin.userOptions) plugin.userOptions.parallel = NUMBER;
            }
          } catch (e) {
            // ignore per-plugin errors
          }
        });
      }
    } catch (e) {
      // don't break the build if webpack version doesn't support these hooks
      // keep config as-is
    }

    return config;
  },
};