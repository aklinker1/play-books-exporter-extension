import { waitFor, waitForElement } from "@/utils/automation";
import { openDb, type Db } from "@/utils/db";
import { ISBN_MAP } from "@/utils/isbns";
import { messenger } from "@/utils/messaging";
import { setState } from "@/utils/state";
import { safeFilename } from "@/utils/strings";

type Metadata = {
  id: string,
  isbn: string,
  title: string,
  author: string,
  rating: number | undefined,
  reviews: number | undefined,
  datePublished: string | undefined,
};

let running = false;
let abortController: AbortController | undefined;

export default defineContentScript({
  matches: ["https://play.google.com/books"],
  async main(ctx) {
    ctx.onInvalidated(() => {
      abortController?.abort("Extension context was invalidated");
    });

    const ui = createIntegratedUi(ctx, {
      anchor: ".pagination-toggle-button",
      append: "after",
      position: "inline",
      onMount: (container) => {
        // Remove the old one
        const id = "play-book-export-start-button";
        document.getElementById(id)?.remove();

        // Add the new one
        const startButton = document.createElement("button");
        startButton.id = id;
        startButton.innerHTML = `<span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span><span class="mdc-button__label">Export all</span><span class="mat-focus-indicator"></span><span class="mat-mdc-button-touch-target"></span><span class="mat-ripple mat-mdc-button-ripple"></span>`;
        startButton.className =
          "mdc-button mat-mdc-button-base gmat-mdc-button mdc-button--outlined mat-mdc-outlined-button mat-primary cdk-focused cdk-mouse-focused";

        startButton.onclick = start;

        container.replaceWith(startButton);
        logger.info("Added start button");
      },
    });
    ui.autoMount();
  },
});

function start(): void {
  if (running) return;

  running = true;
  abortController = new AbortController();
  abortController.signal.onabort = () => {
    running = false;
    abortController = undefined;
  };
  logger.info("Starting...");

  void exportAll()
    .then(async () => {
      logger.info("Success");
      await setState({
        status: "success",
        message: "Done",
        endTime: Date.now(),
      });
    })
    .catch(async (error) => {
      logger.info("Failed", error);
      await setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        endTime: Date.now(),
      });
    })
    .finally(async () => {
      running = false;
      abortController = undefined;
    });
}

function checkAborted() {
  if (abortController?.signal.aborted) throw new Error("Canceled");
}

async function exportAll(): Promise<void> {

  await setState({ startTime: Date.now(), status: "running" });

  logger.info("Getting book count...");
  const bookCountSpan = await waitForElement(
    "the total book count",
    'a[href="/books"] .mat-mdc-menu-item-text span:nth-child(2)',
  );
  const total = Number(bookCountSpan.textContent.trim());
  await setState({ message: `Found ${total} books`, progress: 0, total });
  checkAborted();

  const showAllButton = await waitForElement<HTMLButtonElement>(
    'the "Show All" button',
    ".pagination-toggle-button",
  );
  const showAllText = showAllButton.textContent.trim().toLowerCase();
  if (showAllText === "show all") {
    logger.info("Toggling all books...");
    showAllButton.click();
    await waitFor(
      "pagination to be disabled",
      () =>
        // Check if one "Show 100" button is present, if so, continue
        document.querySelectorAll(".pagination-button").length === 1,
    );
  }
  checkAborted();

  logger.info("Getting book cards...");
  let cards = [...document.querySelectorAll<HTMLElement>("gpb-volume-card")];
  await setState({ message: `Found ${cards.length} cards` });
  if (cards.length != total)
    throw Error(`Expected ${total} books, got ${cards.length}`);
  checkAborted();

  // Uncomment to test a sample
  // cards = cards.slice(0, 1)

  const db = await openDb()
  for (let i = 0; i < cards.length; i++) {
    await exportCard(db, cards[i]!);
    logger.info(`Progress: ${i + 1}/${cards.length}`)
  }
}

export async function exportCard(db: Db, card: HTMLElement): Promise<void> {
  const cardLink = card.querySelector<HTMLAnchorElement>(".card-link")?.href;
  if (!cardLink) throw Error("No card link found");

  const cardUrl = new URL(cardLink, location.origin)
  const type = cardUrl.pathname.endsWith("/listen") ? "audiobook" : "book"
  const id = cardUrl.searchParams.get("id");
  if (!id) throw Error("No id found in card link: " + cardLink);

  const title = card.querySelector(".metadata .title")?.textContent.trim();
  if (!title) throw Error("No .title element found");

  const author = card.querySelector(".metadata .author")?.textContent.trim();
  if (!author) throw Error("No .author element found");

  logger.info(`--------------------`);
  logger.info(`${author}/${title} [${id}]`);

  if (await db.downloaded(id)) {
    logger.warn(`Already downloaded, skipping`);
    return;
  }

  const coverUrl = card.querySelector<HTMLImageElement>(
    ".refresh-cover-image",
  )?.src;
  if (!coverUrl) throw Error("No cover image found");

  const detailsPageHtml = await downloadDetailsPage(id, type);
  const detailsPage = new DOMParser().parseFromString(
    detailsPageHtml,
    "text/html",
  );

  const dataJsonText = detailsPage
    .querySelector('script[type="application/ld+json"]')
    ?.textContent.trim();
  if (!dataJsonText) throw Error("No data JSON script found");
  const dataJson = JSON.parse(dataJsonText);
  logger.debug("application/ld+json", dataJson);

  const workExample = type === "audiobook" ?  dataJson.workExample?.[0] :  dataJson.workExample
  const isbn = (workExample?.isbn as string | undefined) ?? ISBN_MAP[id] ?? ("GP-" + id);
  if (!isbn) throw Error("No ISBN found");

  const datePublished = workExample?.datePublished as
    string | undefined;

  const rating = dataJson.aggregateRating?.ratingValue;
  const reviews = dataJson.aggregateRating?.ratingCount

  // TODO: support audiobooks
  if (type === "book") {
    logger.warn(`Ebooks not supported: "${title}"`)
    return;
  }

  let itemCount = 0;
  await runInMenu(card, async (items) => {
    logger.debug(`Exporting ${items.length} menu items...`);
    if (items.length === 0) return;

    itemCount = items.length;
    const item = items[0]!;
    logger.debug(`Exporting "${item.textContent}"...`);
    await exportFromCardMenu(isbn, author, title, item);
  });

  if (itemCount === 0) {
    logger.warn(`No exports for "${title}"`)
    return
  }

  for (let i = 1; i < itemCount; i++) {
    await runInMenu(card, (items) => {
      const item = items[i]!;
      logger.debug(`Exporting "${item.textContent}"...`);
      return exportFromCardMenu(isbn, author, title, item);
    });
  }

  logger.debug("Exporting cover...")
  await downloadCover(isbn, author, title, coverUrl);

  logger.debug("Exporting cover...")
  await downloadMetadata({
    id,
    isbn,
    title,
    author,
    rating,
    reviews,
    datePublished,
  })

  await db.saveId(id)
}

async function downloadDetailsPage(id: string, type: "audiobook" | "book"): Promise<string> {
  const url = new URL(`/store/${type}s/details`, location.origin);
  url.searchParams.set("id", id);

  const res = await fetch(url);
  if (!res.ok) throw Error("Failed to fetch details page: " + res.statusText);

  return await res.text();
}

async function downloadCover(
  isbn: string,
  author: string,
  title: string,
  url: string,
): Promise<void> {
  await messenger.sendMessage("download-file", {
    url,
    filename: safeFilename(`play-books-exporter/${author}/${title} [${isbn}]/cover.jpg`),
    conflictAction: "overwrite",
  });
}

async function runInMenu(
  card: HTMLElement,
  fn: (items: HTMLElement[]) => Promise<void>,
): Promise<void> {
  const menuButton = card.querySelector<HTMLButtonElement>(".overflow");
  if (!menuButton) throw Error("No overflow menu button found");

  menuButton.click();
  const menu = await waitForElement(
    "the book's overflow menu to appear",
    ".mat-mdc-menu-content",
  );
  const exportItems: HTMLElement[] = [];
  for (const item of menu.querySelectorAll<HTMLButtonElement>(
    "button.mat-mdc-menu-item",
  )) {
    const text = item.textContent.toLowerCase().trim();
    if (text === "export" || text.includes("download")) {
      exportItems.push(item);
    }
  }

  await fn(exportItems);
  await closeMenu();
}

async function closeMenu() {
  const backdropSelector = ".cdk-overlay-backdrop";
  const backdrop = document.querySelector<HTMLDivElement>(backdropSelector);
  backdrop?.click();
  await waitForElementGone("the menu backdrop", backdropSelector);
}

/**
 * Cancel the restart the download with a different filename.
 */
async function exportFromCardMenu(
  isbn: string,
  author: string,
  title: string,
  item: HTMLElement,
) {
  let time: number;
  if (item.textContent.trim().toLowerCase() === "export") {
    // Download audiobooks in high-quality
    item.click();
    time = Date.now();
    const downloadButton = await waitForElement<HTMLButtonElement>(
      "the download button",
      "#high-quality-button",
    );
    downloadButton.click();
  } else {
    // Supplemental PDFs don't have a quality option
    time = Date.now();
    item.click();
  }

  const download = await messenger.sendMessage(
    "cancel-first-download-after",
    time,
  );

  const ext = download.filename.split(".").at(-1);
  const filename = safeFilename(`play-books-exporter/${author}/${title} [${isbn}]/${title} [${isbn}].${ext}`);

  await messenger.sendMessage("download-file", {
    filename,
    url: download?.url,
    conflictAction: "overwrite",
  });
}

async function downloadMetadata(metadata: Metadata): Promise<void> {
  const filename = safeFilename(`play-books-exporter/${metadata.author}/${metadata.title} [${metadata.isbn}]/metadata.nfo`);

  const lines = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>`,
    `<metadata>`,
    `  <title>${metadata.title}</title>`,
    `  <isbn>${metadata.isbn}</isbn>`,
    `  <externalid>`,
    `    <provider>google-play-books</provider>`,
    `    <id>${metadata.id}</id>`,
    `  </externalid>`,
    `  <author>${metadata.author}</author>`,
    ...(metadata.rating == null ? [] : [`  <rating>${metadata.rating}</rating>`]),
    ...(metadata.reviews == null ? [] : [`  <reviews>${metadata.reviews}</reviews>`]),
    ...(metadata.datePublished == null ? [] : [`  <datePublished>${metadata.datePublished}</datePublished>`]),
    `<metadata>`,
    ``
  ]

  await messenger.sendMessage('download-text', {
    content: lines.join("\n"),
    filename,
  })
}
