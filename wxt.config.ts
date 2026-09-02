import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  manifest: {
    permissions: ["storage", "downloads"],
    browser_specific_settings: {
      gecko: {
        id: "@play-books-exporter",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
  webExt: {
    disabled: true,
  },
});
