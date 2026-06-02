import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f9f9f9',
          100: '#f2f2f2',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        gold: {
          50: '#fbf9f4',
          100: '#f7f2e6',
          200: '#ecdcb9',
          300: '#e0c388',
          400: '#d3aa58',
          500: '#c59231',
          600: '#aa7822',
          700: '#8c601c',
          800: '#6d4816',
          900: '#4f3210',
        }
      },
    },
  },
  plugins: [],
};
export default config;
