// Serves "/" and, for ?lang=es, rewrites the head of index.html so the Spanish
// page is its own page to search engines and link scrapers: they read the
// markup before any script runs, and the static canonical points at "/", which
// would fold the Spanish version into the English one. See #243.
//
// Every other request (English, unknown ?lang=, errors) gets the static file
// untouched, and so does ?lang=es if the catalog cannot be read: a page with
// English metadata is better than no page.

const SITE_URL = 'https://flagfilter.com/';

// Languages whose head is rewritten, with their og:locale. English is the
// static file itself.
const OG_LOCALES = { es: 'es_ES' };

// The catalogs are immutable for the lifetime of a deployment.
const catalogPromises = new Map();

async function loadCatalog(context, language) {
    if (!catalogPromises.has(language)) {
        const url = new URL(`/i18n/ui/${language}.json`, context.request.url);
        const promise = context.env.ASSETS.fetch(new Request(url.toString()))
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`${url.pathname} answered ${response.status}`);
                }
                return response.json();
            })
            .catch((error) => {
                // Do not cache a failure; the next request tries again.
                catalogPromises.delete(language);
                throw error;
            });
        catalogPromises.set(language, promise);
    }
    return catalogPromises.get(language);
}

function setAttribute(name, value) {
    return { element(element) { element.setAttribute(name, value); } };
}

export async function onRequestGet(context) {
    const response = await context.next();
    const language = new URL(context.request.url).searchParams.get('lang');
    if (!Object.hasOwn(OG_LOCALES, language) || response.status !== 200) {
        return response;
    }

    let catalog;
    try {
        catalog = await loadCatalog(context, language);
    } catch (error) {
        console.error('Could not localize the page head:', error);
        return response;
    }

    const pageUrl = `${SITE_URL}?lang=${language}`;
    const rewritten = new HTMLRewriter()
        .on('html', setAttribute('lang', language))
        .on('title', { element(element) { element.setInnerContent(catalog.page_title); } })
        .on('meta[name="description"]', setAttribute('content', catalog.meta_description))
        .on('meta[property="og:title"]', setAttribute('content', catalog.page_title))
        .on('meta[property="og:description"]', setAttribute('content', catalog.meta_description))
        .on('meta[property="og:locale"]', setAttribute('content', OG_LOCALES[language]))
        .on('meta[property="og:url"]', setAttribute('content', pageUrl))
        .on('link[rel="canonical"]', setAttribute('href', pageUrl))
        .transform(response);

    // The static file's ETag describes the English bytes, and the catalog can
    // change without index.html changing. Without it the browser revalidates by
    // date or refetches, which for one small HTML file is cheap.
    const headers = new Headers(rewritten.headers);
    headers.delete('ETag');
    return new Response(rewritten.body, { status: rewritten.status, headers });
}
