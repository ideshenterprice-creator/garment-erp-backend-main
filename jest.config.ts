import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFiles: ["dotenv/config"],
  testTimeout: 30000,
  clearMocks: true,
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: {
          strict: true,
          esModuleInterop: true,
          module: "commonjs",
          target: "ES2020",
        },
      },
    ],
  },
};

export default config;
