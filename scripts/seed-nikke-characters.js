import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';
import { NIKKE_UNITS, getCharacterByName } from '../src/services/nikke.js';
import { pgConfig, resolveSslConfig } from '../src/config/database/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const MAX_DIAGNOSTIC_SAMPLES = 5;

function slug(value) {
    return String(value)
        .toLowerCase()
        .replace(/[:]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function buildDotGgThumbnail(img) {
    return `https://static.dotgg.gg/nikke/characters/${img}.webp`;
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function normalizeCharacterName(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function addCappedSample(target, value, maxSize = MAX_DIAGNOSTIC_SAMPLES) {
    if (!Array.isArray(target) || target.length >= maxSize) {
        return;
    }

    target.push(value);
}

function findScrapeCandidates(normalizedName, scrapedKeys, limit = 3) {
    if (!normalizedName || !Array.isArray(scrapedKeys) || scrapedKeys.length === 0) {
        return [];
    }

    const tokens = normalizedName.split(' ').filter((token) => token.length >= 4);
    const candidates = [];

    for (const key of scrapedKeys) {
        if (key.includes(normalizedName) || normalizedName.includes(key) || tokens.some((token) => key.includes(token))) {
            candidates.push(key);
        }

        if (candidates.length >= limit) {
            break;
        }
    }

    return candidates;
}

function parsePlayerItemsFromHtml(html, pageUrl) {
    const thumbnailMap = new Map();
    const segments = html.split(/<div[^>]*data-cname="player-item"[^>]*>/i);
    const diagnostics = {
        segmentCount: Math.max(segments.length - 1, 0),
        extractedCount: 0,
        missingNameCount: 0,
        missingSrcCount: 0,
        invalidUrlCount: 0,
        extractionSamples: [],
    };

    for (let index = 1; index < segments.length; index += 1) {
        const block = segments[index];
        const srcMatch = block.match(/<img[^>]*class="[^"]*nikkes-player-item-img[^"]*"[^>]*src="([^"]+)"/i);
        const nameMatch = block.match(/<p[^>]*class="[^"]*name[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);

        if (!srcMatch) {
            diagnostics.missingSrcCount += 1;
        }

        if (!nameMatch) {
            diagnostics.missingNameCount += 1;
        }

        if (!srcMatch || !nameMatch) {
            continue;
        }

        const name = decodeHtmlEntities(nameMatch[1]).trim();
        const normalizedName = normalizeCharacterName(name);
        if (!normalizedName) {
            continue;
        }

        let thumbnailUrl;
        try {
            thumbnailUrl = new URL(srcMatch[1], pageUrl).href;
        } catch {
            diagnostics.invalidUrlCount += 1;
            continue;
        }

        thumbnailMap.set(normalizedName, thumbnailUrl);
        diagnostics.extractedCount += 1;
        addCappedSample(diagnostics.extractionSamples, {
            rawName: name,
            normalizedName,
            thumbnailUrl,
        });
    }

    return {
        thumbnailMap,
        diagnostics,
    };
}

async function fetchPlayerItemThumbnails(pageUrl) {
    logger.info('Fetching Nikke list page for thumbnail scraping', {
        event: 'nikke_characters.seed.scrape.fetch.start',
        sourceUrl: pageUrl,
    });

    const response = await fetch(pageUrl, {
        headers: {
            'User-Agent': 'FreedomBot/1.0 (+nikke-character-seeder)',
            'Accept': 'text/html,application/xhtml+xml',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch player item page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const contentType = response.headers.get('content-type') || 'unknown';
    const parseResult = parsePlayerItemsFromHtml(html, pageUrl);

    logger.info('Fetched and parsed Nikke list page', {
        event: 'nikke_characters.seed.scrape.fetch.complete',
        sourceUrl: pageUrl,
        finalUrl: response.url,
        redirected: response.redirected,
        status: response.status,
        contentType,
        htmlLength: html.length,
        hasPlayerItemMarker: html.includes('data-cname="player-item"'),
        segmentCount: parseResult.diagnostics.segmentCount,
        extractedCount: parseResult.diagnostics.extractedCount,
        missingNameCount: parseResult.diagnostics.missingNameCount,
        missingSrcCount: parseResult.diagnostics.missingSrcCount,
        invalidUrlCount: parseResult.diagnostics.invalidUrlCount,
        extractionSamples: parseResult.diagnostics.extractionSamples,
    });

    return parseResult;
}

function normalizeUnits(units) {
    const dedupedByNameCode = new Map();

    for (const unit of units) {
        const id = Number.parseInt(String(unit?.id), 10);
        const nameCode = Number.parseInt(String(unit?.name_code), 10);
        const name = String(unit?.name || '').trim();

        if (!Number.isInteger(id) || !Number.isInteger(nameCode) || !name) {
            continue;
        }

        dedupedByNameCode.set(nameCode, {
            id,
            name_code: nameCode,
            name,
            thumbnail: unit?.thumbnail || null,
        });
    }

    return [...dedupedByNameCode.values()];
}

async function resolveThumbnailForUnit(unit, scrapedThumbnailMap, scrapedKeys) {
    const normalizedName = normalizeCharacterName(unit.name);

    if (unit.thumbnail) {
        return {
            thumbnail: unit.thumbnail,
            source: 'existing_thumbnail',
            normalizedName,
        };
    }

    const scrapedThumbnail = scrapedThumbnailMap?.get(normalizedName);
    if (scrapedThumbnail) {
        return {
            thumbnail: scrapedThumbnail,
            source: 'scraped_match',
            normalizedName,
        };
    }

    try {
        const response = await getCharacterByName(slug(unit.name));
        if (!response.ok) {
            return {
                thumbnail: null,
                source: 'unresolved',
                normalizedName,
                dotggStatus: String(response.status),
                unresolvedReason: 'dotgg_http_error',
                scrapeCandidates: findScrapeCandidates(normalizedName, scrapedKeys),
            };
        }

        const payload = await response.json();
        const img = payload?.img;
        if (!img) {
            return {
                thumbnail: null,
                source: 'unresolved',
                normalizedName,
                dotggStatus: String(response.status),
                unresolvedReason: 'dotgg_missing_img',
                scrapeCandidates: findScrapeCandidates(normalizedName, scrapedKeys),
            };
        }

        return {
            thumbnail: buildDotGgThumbnail(img),
            source: 'dotgg_fallback',
            normalizedName,
            dotggStatus: String(response.status),
        };
    } catch (error) {
        return {
            thumbnail: null,
            source: 'unresolved',
            normalizedName,
            dotggStatus: 'error',
            unresolvedReason: 'dotgg_exception',
            scrapeCandidates: findScrapeCandidates(normalizedName, scrapedKeys),
            errorMessage: error.message,
        };
    }
}

async function enrichUnitsWithThumbnails(units) {
    const nikkeListUrl = process.env.NIKKE_LIST_URL || 'https://www.blablalink.com/shiftyspad/nikke-list';
    let scrapedThumbnailMap = new Map();
    let scrapeDiagnostics = null;

    try {
        const scrapeResult = await fetchPlayerItemThumbnails(nikkeListUrl);
        scrapedThumbnailMap = scrapeResult.thumbnailMap;
        scrapeDiagnostics = scrapeResult.diagnostics;

        logger.info('Loaded scraped Nikke thumbnails', {
            event: 'nikke_characters.seed.scrape.completed',
            sourceUrl: nikkeListUrl,
            scrapedCount: scrapedThumbnailMap.size,
            segmentCount: scrapeDiagnostics?.segmentCount ?? 0,
            extractedCount: scrapeDiagnostics?.extractedCount ?? 0,
            missingNameCount: scrapeDiagnostics?.missingNameCount ?? 0,
            missingSrcCount: scrapeDiagnostics?.missingSrcCount ?? 0,
            invalidUrlCount: scrapeDiagnostics?.invalidUrlCount ?? 0,
        });
    } catch (error) {
        logger.warn(`Failed to scrape Nikke thumbnails from ${nikkeListUrl}: ${error.message}`);
    }

    const scrapedKeys = [...scrapedThumbnailMap.keys()];
    const enrichedRowsWithMeta = await Promise.all(
        units.map(async (unit) => {
            const result = await resolveThumbnailForUnit(unit, scrapedThumbnailMap, scrapedKeys);
            return {
                ...unit,
                thumbnail: result.thumbnail,
                _resolution: result,
            };
        }),
    );

    const resolutionDiagnostics = {
        sourceCounts: {
            existing_thumbnail: 0,
            scraped_match: 0,
            dotgg_fallback: 0,
            unresolved: 0,
        },
        dotgg: {
            attempts: 0,
            successes: 0,
            statusCounts: {},
        },
        unresolvedSamples: [],
        scrapedMatchSamples: [],
    };

    for (const row of enrichedRowsWithMeta) {
        const source = row._resolution?.source || 'unresolved';
        if (resolutionDiagnostics.sourceCounts[source] === undefined) {
            resolutionDiagnostics.sourceCounts[source] = 0;
        }
        resolutionDiagnostics.sourceCounts[source] += 1;

        if (source === 'scraped_match') {
            addCappedSample(resolutionDiagnostics.scrapedMatchSamples, {
                name: row.name,
                normalizedName: row._resolution?.normalizedName || null,
                thumbnail: row.thumbnail,
            });
        }

        if (source === 'dotgg_fallback' || row._resolution?.dotggStatus) {
            const status = row._resolution?.dotggStatus || 'unknown';
            resolutionDiagnostics.dotgg.attempts += 1;
            resolutionDiagnostics.dotgg.statusCounts[status] =
                (resolutionDiagnostics.dotgg.statusCounts[status] || 0) + 1;

            if (source === 'dotgg_fallback') {
                resolutionDiagnostics.dotgg.successes += 1;
            }
        }

        if (source === 'unresolved') {
            addCappedSample(resolutionDiagnostics.unresolvedSamples, {
                name: row.name,
                normalizedName: row._resolution?.normalizedName || null,
                reason: row._resolution?.unresolvedReason || 'unknown',
                dotggStatus: row._resolution?.dotggStatus || null,
                scrapeCandidates: row._resolution?.scrapeCandidates || [],
                errorMessage: row._resolution?.errorMessage || null,
            });
        }
    }

    logger.info('Nikke thumbnail resolution diagnostics', {
        event: 'nikke_characters.seed.thumbnail_resolution',
        sourceUrl: nikkeListUrl,
        scrapedCount: scrapedThumbnailMap.size,
        sourceCounts: resolutionDiagnostics.sourceCounts,
        dotggAttempts: resolutionDiagnostics.dotgg.attempts,
        dotggSuccesses: resolutionDiagnostics.dotgg.successes,
        dotggStatusCounts: resolutionDiagnostics.dotgg.statusCounts,
        unresolvedSamples: resolutionDiagnostics.unresolvedSamples,
        scrapedMatchSamples: resolutionDiagnostics.scrapedMatchSamples,
    });

    return {
        rows: enrichedRowsWithMeta.map(({ _resolution, ...row }) => row),
        diagnostics: {
            scrape: scrapeDiagnostics,
            resolution: resolutionDiagnostics,
            scrapedCount: scrapedThumbnailMap.size,
            sourceUrl: nikkeListUrl,
        },
    };
}

async function run() {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('Missing POSTGRES_URL (or DATABASE_URL) in environment.');
    }

    const pool = new Pool({
        connectionString,
        ssl: resolveSslConfig(),
    });

    const normalizedRows = normalizeUnits(NIKKE_UNITS);
    const enrichmentResult = await enrichUnitsWithThumbnails(normalizedRows);
    const rows = enrichmentResult.rows;
    const diagnostics = enrichmentResult.diagnostics;
    if (rows.length === 0) {
        throw new Error('No valid Nikke units found to seed.');
    }

    const ids = rows.map((row) => row.id);
    const nameCodes = rows.map((row) => row.name_code);
    const names = rows.map((row) => row.name);
    const thumbnails = rows.map((row) => row.thumbnail);

    const table = pgConfig.tables.nikke_characters;
    const truncate = process.argv.includes('--truncate');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (truncate) {
            await client.query(`TRUNCATE TABLE ${table}`);
        }

        const upsertResult = await client.query(
            `INSERT INTO ${table} (id, name_code, name, thumbnail)
             SELECT seeded.id, seeded.name_code, seeded.name, seeded.thumbnail
             FROM UNNEST($1::int[], $2::int[], $3::text[], $4::text[]) AS seeded(id, name_code, name, thumbnail)
             ON CONFLICT (name_code)
             DO UPDATE SET
                 id = EXCLUDED.id,
                 name = EXCLUDED.name,
                 thumbnail = EXCLUDED.thumbnail,
                 updated_at = CURRENT_TIMESTAMP`,
            [ids, nameCodes, names, thumbnails],
        );

        await client.query('COMMIT');

        logger.info('Nikke characters seed completed', {
            event: 'nikke_characters.seed.completed',
            table,
            sourceCount: rows.length,
            thumbnailsResolved: rows.filter((row) => Boolean(row.thumbnail)).length,
            affectedRows: upsertResult.rowCount,
            truncated: truncate,
            scrapeSourceUrl: diagnostics?.sourceUrl || null,
            scrapedCount: diagnostics?.scrapedCount || 0,
            scrapeDiagnostics: diagnostics?.scrape || null,
            resolutionDiagnostics: diagnostics?.resolution || null,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((error) => {
    logger.error('Failed to seed nikke_characters table', {
        event: 'nikke_characters.seed.failed',
        error: error.message,
    });
    process.exit(1);
});
