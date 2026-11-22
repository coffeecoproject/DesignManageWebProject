import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The dev and preview servers listen on this worktree's napbox host port; scripts/local/dev-web.sh sets it.
function readWebPort(mode: string): number {
  const raw = loadEnv(mode, '.', 'SMS_').SMS_WEB_PORT;
  const port = Number(raw);

  if (!raw || !Number.isInteger(port) || port <= 0) {
    throw new Error('SMS_WEB_PORT is not set; start the web dev server with `corepack pnpm dev:web` (scripts/local/dev-web.sh).');
  }

  return port;
}

export default defineConfig(({ command, mode }) => {
  const port = command === 'serve' ? readWebPort(mode) : undefined;

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll('\\', '/');

            if (!moduleId.includes('node_modules')) {
              return undefined;
            }

            if (
              moduleId.includes('/react/') ||
              moduleId.includes('/react-dom/') ||
              moduleId.includes('/react-router')
            ) {
              return 'vendor-react';
            }

            if (moduleId.includes('/@ant-design/pro-')) {
              return 'vendor-ant-design-pro';
            }

            if (moduleId.includes('/@ant-design/icons')) {
              return 'vendor-ant-design-icons';
            }

            if (
              moduleId.includes('/antd/es/table') ||
              moduleId.includes('/rc-table') ||
              moduleId.includes('/rc-pagination') ||
              moduleId.includes('/rc-virtual-list')
            ) {
              return 'vendor-ant-design-table';
            }

            if (
              moduleId.includes('/antd/es/form') ||
              moduleId.includes('/rc-field-form') ||
              moduleId.includes('/@rc-component/async-validator')
            ) {
              return 'vendor-ant-design-form';
            }

            if (
              moduleId.includes('/antd/es/date-picker') ||
              moduleId.includes('/antd/es/time-picker') ||
              moduleId.includes('/rc-picker') ||
              moduleId.includes('/dayjs/')
            ) {
              return 'vendor-ant-design-date';
            }

            if (
              moduleId.includes('/antd/es/select') ||
              moduleId.includes('/antd/es/dropdown') ||
              moduleId.includes('/antd/es/menu') ||
              moduleId.includes('/rc-select') ||
              moduleId.includes('/rc-menu') ||
              moduleId.includes('/rc-dropdown') ||
              moduleId.includes('/rc-trigger')
            ) {
              return 'vendor-ant-design-overlay';
            }

            if (moduleId.includes('/antd/') || moduleId.includes('/rc-') || moduleId.includes('/@rc-component/')) {
              return 'vendor-ant-design-core';
            }

            return 'vendor';
          }
        }
      }
    },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true
    },
    preview: {
      host: '127.0.0.1',
      port,
      strictPort: true
    }
  };
});
