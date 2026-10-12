import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "content-source/**", "content-processed/**", "desktop/**", "next-env.d.ts"] },
];

export default config;
