# Play Books Exporter

Automate exporting all books in your google play books library.

1. Build zip: `bun i && bun zip` or `bun i && bun zip:firefox` (publishing an extension on the CWS is a lot of work... that I don't want to do for this)
2. Install the zip in your browser (google it)
3. Open <https://play.google.com/books>
4. In the top right above the list of books, click "Export All"
5. Wait for it to finish, it can take hours. View progress in dev console

It will only download new books the extension hasn't downloaded before if you run it again.

Output folder structure:

```
~/Downloads/
    play-books-exporter/
        {author}/
            {title} [{externalId}]/
                {title} [externalId].m4a
                cover.jpg
                metadata.nfo
```

## Supported formats

- ✅ Audiobooks with an "Export" option
- ❌ ~EPUBs with an "Export" option~
   > These export "ACSM", not the epub directly, so it's not supported
- ❌ ~PDFs with an "Export" option~
   > I don't have any of these in my library
- ❌ ~Non-exported audiobooks and epubs~
   > Out-of-scope for this project

Soooo.... really just audiobooks

## Development

```sh
bun dev
# or
bun dev:firefox
```

Install the dev folder in your browser manually, you can reload the extension via `alt+R`.

## Future work

- At least download the ACSM file for EPUBs
- PDF support
- Parallelize the downloads, allow for downloading more than 1 file at a time
- Grab book description

Feel free to implement and open a PR for any of these.
