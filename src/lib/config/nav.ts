import type { Pathname } from '$app/types';

export interface NavItem {
	label: string;
	href: Pathname;
	/** Only shown to authenticated singers. */
	authOnly?: boolean;
}

/** Top-level navigation for the singer portal. */
export const navItems: NavItem[] = [
	{ label: 'Request', href: '/songs', authOnly: true },
	{ label: 'My Requests', href: '/requests', authOnly: true },
	{ label: 'History', href: '/history', authOnly: true },
	{ label: 'Profile', href: '/profile', authOnly: true }
];

/** Filters the navigation for the current authentication state. */
export function visibleNavItems(isAuthenticated: boolean): NavItem[] {
	return navItems.filter((item) => !item.authOnly || isAuthenticated);
}
