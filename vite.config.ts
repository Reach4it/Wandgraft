import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
