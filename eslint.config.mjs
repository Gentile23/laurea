import nextVitals from "eslint-config-next/core-web-vitals";

const ignored = [
  ".next/**",
  "out/**",
  "node_modules/**",
  "next-env.d.ts"
];

const config = [
  ...nextVitals,
  {
    ignores: ignored
  }
];

export default config;
