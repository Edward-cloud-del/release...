// Utility functions for the app
import packageJson from '../../package.json';

export const VERSION = packageJson.version;

export const IS_DEVELOPMENT = import.meta.env.MODE === 'development';
export const IS_PRODUCTION = !IS_DEVELOPMENT;

// show browser / native notification
export function notify(title: string, body: string) {
	new Notification(title, { body: body || "", });
}

export function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Joins path segments with a specified separator
 * @param separator The separator to use between segments (e.g., '/', '\', '.')
 * @param segments The path segments to join
 * @returns The joined path string
 */
export function join(separator: string, ...segments: string[]): string | null {
	if (!segments || segments.length === 0) return '';
	if (segments.find(x => !(typeof x === 'string'))) return null;
	return segments.join(separator);
}