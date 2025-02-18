import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["__test__/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules"], // 排除的文件
    coverage: {
      provider: "v8",
    },
  },
});
