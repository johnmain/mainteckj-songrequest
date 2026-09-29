import { describe, expect, it } from 'vitest';
import { navItems, visibleNavItems } from './nav';

describe('visibleNavItems', () => {
	it('hides every item from signed-out visitors', () => {
		expect(visibleNavItems(false)).toEqual([]);
	});

	it('shows every item to authenticated singers', () => {
		expect(visibleNavItems(true)).toHaveLength(navItems.length);
	});

	it('never leaks auth-only items into the public navigation', () => {
		const items = visibleNavItems(false);
		expect(items.every((item) => item.authOnly !== true)).toBe(true);
	});
});
