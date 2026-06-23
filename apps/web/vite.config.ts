import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
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
    port: 5173,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true
  }
});
