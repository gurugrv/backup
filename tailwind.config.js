/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#007bff',
        'primary-hover': '#0056b3',
        success: '#28a745',
        error: '#dc3545'
      },
      cursor: {
        'not-allowed': 'not-allowed',
        'pointer': 'pointer'
      }
    }
  },
  plugins: [],
  safelist: [
    'cursor-not-allowed',
    'cursor-pointer',
    'hidden',
    {
      pattern: /bg-(primary|success|error|gray|blue|red)-(50|100|200|300|400|500|600|700)/,
    },
    {
      pattern: /text-(primary|success|error|gray|blue|red)-(50|100|200|300|400|500|600|700)/,
    },
    {
      pattern: /border-(primary|success|error|gray|blue|red)-(50|100|200|300|400|500|600|700)/,
    }
  ]
}
