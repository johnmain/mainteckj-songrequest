export interface CatalogInputRow {
	title: string;
	artist: string;
}

export type CatalogFormat = 'auto' | 'json' | 'csv';

const DELIMITERS = [',', '\t', ';'] as const;

/**
 * Parses the desktop app's master song export into title/artist rows.
 * Accepts JSON (array of objects or `[title, artist]` pairs, optionally
 * wrapped in `{ "songs": [...] }`) or delimited text (CSV/TSV).
 */
export function parseCatalogExport(
	input: string,
	format: CatalogFormat = 'auto'
): CatalogInputRow[] {
	const trimmed = input.trim();
	if (!trimmed) return [];

	const resolved = format === 'auto' ? detectFormat(trimmed) : format;
	return resolved === 'json' ? parseJsonCatalog(trimmed) : parseCsvCatalog(input);
}

function detectFormat(text: string): 'json' | 'csv' {
	return text.startsWith('[') || text.startsWith('{') ? 'json' : 'csv';
}

function parseJsonCatalog(text: string): CatalogInputRow[] {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('Invalid JSON catalog export');
	}

	if (data && typeof data === 'object' && !Array.isArray(data)) {
		const songs = (data as { songs?: unknown }).songs;
		if (Array.isArray(songs)) data = songs;
	}

	if (!Array.isArray(data)) {
		throw new Error('JSON catalog export must be an array of songs');
	}

	return data.map((entry, index) => {
		if (Array.isArray(entry)) {
			return { title: String(entry[0] ?? ''), artist: String(entry[1] ?? '') };
		}
		if (entry && typeof entry === 'object') {
			const record = entry as Record<string, unknown>;
			const title = record.title ?? record.Title ?? record.name;
			const artist = record.artist ?? record.Artist ?? record.performer;
			return { title: String(title ?? ''), artist: String(artist ?? '') };
		}
		throw new Error(`Unsupported catalog entry at index ${index}`);
	});
}

function parseCsvCatalog(text: string): CatalogInputRow[] {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
	const delimiter = detectDelimiter(firstLine);
	const rows = splitDelimited(text, delimiter).filter((cells) =>
		cells.some((cell) => cell.trim() !== '')
	);
	if (rows.length === 0) return [];

	const header = rows[0].map((cell) => cell.trim().toLowerCase());
	const titleIndex = header.indexOf('title');
	const artistIndex = header.indexOf('artist');
	const hasHeader = titleIndex !== -1 && artistIndex !== -1;

	const dataRows = hasHeader ? rows.slice(1) : rows;
	const titleColumn = hasHeader ? titleIndex : 0;
	const artistColumn = hasHeader ? artistIndex : 1;

	return dataRows.map((cells) => ({
		title: (cells[titleColumn] ?? '').trim(),
		artist: (cells[artistColumn] ?? '').trim()
	}));
}

function detectDelimiter(firstLine: string): string {
	let best: string = DELIMITERS[0];
	let bestCount = 0;
	for (const delimiter of DELIMITERS) {
		const count = firstLine.split(delimiter).length - 1;
		if (count > bestCount) {
			best = delimiter;
			bestCount = count;
		}
	}
	return best;
}

/** Minimal RFC-4180 style splitter supporting quoted fields and embedded newlines. */
function splitDelimited(text: string, delimiter: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === delimiter) {
			row.push(field);
			field = '';
		} else if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (char !== '\r') {
			field += char;
		}
	}

	row.push(field);
	rows.push(row);
	return rows;
}
