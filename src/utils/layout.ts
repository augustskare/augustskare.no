import { html, type SafeHtml } from "remix/html-template";

export function layout(children: SafeHtml, title?: string): SafeHtml {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>${title ?? "August Skare"}</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        ${children}

        <footer>
          <nav>
            <ul>
              <li><a href="/bookshelf">/bookshelf</a></li>
            </ul>
          </nav>
        </footer>
      </body>
    </html> `;
}
