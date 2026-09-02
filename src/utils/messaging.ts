import { defineExtensionMessaging } from '@webext-core/messaging'

export const messenger = defineExtensionMessaging<{
  'download-file'(options: Browser.downloads.DownloadOptions): void
  'download-text'(options: { filename: string, content: string }): void;
  'cancel-first-download-after'(date: number): Browser.downloads.DownloadItem
}>()
