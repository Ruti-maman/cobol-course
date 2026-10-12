import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "content-source/**", "content-processed/**", "content-enhanced/**", "content-compressed/**","desktop/**", "next-env.d.ts"] },
];

export default config;
