import { messenger } from "@/utils/messaging";

export default defineBackground({
  type: "module",
  main() {
    messenger.onMessage("download-file", async ({ data }) => {
      const id = await browser.downloads.download(data);
      await waitForDownload(id);
    });

    messenger.onMessage("download-text", async ({ data }) => {
      const blob = new Blob([data.content], { type: "text/plain" })
      const url = URL.createObjectURL(blob);
      const id = await browser.downloads.download({
        url,
        filename: data.filename,
        conflictAction: "overwrite"
      });
      await waitForDownload(id);
    })

    messenger.onMessage(
      "cancel-first-download-after",
      async ({ data: time }) => {
        let res: Browser.downloads.DownloadItem | undefined;

        await waitFor("the download to start", async () => {
          const downloads = (
            await browser.downloads.search({
              state: "in_progress",
              orderBy: ["-startTime"],
              startedAfter: new Date(time).toISOString(),
              limit: 1,
            })
          ).filter(
            (download) => download.referrer === "https://play.google.com/books",
          );

          res = downloads[0];
          return downloads.length > 0;
        }, { intervalMs: 0 });
        if (!res) throw Error("Not possible: res not set");

        await browser.downloads.cancel(res.id);
        return res;
      },
    );
  },
});

function waitForDownload(id: number): Promise<void> {
  return waitFor(
    "download to finish",
    async () => {
      const [download] = await browser.downloads.search({ id });
      return !!download && download.state != "in_progress";
    },
    {
      // Never timeout waiting for the download to finish
      timeoutMs: Number.POSITIVE_INFINITY,
      intervalMs: 1e3,
    },
  );
}
