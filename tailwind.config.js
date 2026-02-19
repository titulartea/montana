/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        obsidian: {
          bg: 'var(--bg-main)',
          sidebar: 'var(--bg-sidebar)',
          accent: 'var(--bg-accent)',
          text: 'var(--text-main)',
          muted: 'var(--text-muted)',
          border: 'var(--border-color)',
          hover: 'var(--bg-hover)',
          editor: 'var(--editor-bg)',
          code: 'var(--code-bg)',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
