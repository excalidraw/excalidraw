/**
 * Capacitor utilities for handling deep links and in-app browser functionality.
 * This module provides platform-specific handling for library installation from
 * external sources like libraries.excalidraw.com.
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App, URLOpenListenerEvent } from '@capacitor/app';

/**
 * Check if we're running on a native Capacitor platform (Android/iOS)
 */
export const isCapacitorNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Check if we're running specifically on Android
 */
export const isAndroid = (): boolean => {
    return Capacitor.getPlatform() === 'android';
};

/**
 * Check if we're running specifically on iOS
 */
export const isIOS = (): boolean => {
    return Capacitor.getPlatform() === 'ios';
};

/**
 * The custom URL scheme used for deep linking library installations
 */
export const LIBRARY_URL_SCHEME = 'excalidraw';
export const LIBRARY_URL_HOST = 'library';

/**
 * Get the library return URL for the current platform.
 * On native platforms, returns a custom URL scheme that can be used for deep linking.
 * On web, returns undefined to use the default behavior.
 */
export const getLibraryReturnUrl = (): string | undefined => {
    if (isCapacitorNative()) {
        // Use custom URL scheme for native platforms
        // Add trailing slash for better compatibility with URL parsing on some browsers
        return `${LIBRARY_URL_SCHEME}://${LIBRARY_URL_HOST}/`;
    }
    return undefined; // Use default (window.location.origin + pathname)
};

/**
 * Open a URL in the in-app browser (Chrome Custom Tabs on Android, Safari VC on iOS).
 * This keeps the browsing session within the app context, allowing for better
 * redirect handling.
 */
export const openInAppBrowser = async (url: string): Promise<void> => {
    if (isCapacitorNative()) {
        await Browser.open({
            url,
            windowName: '_blank',
            presentationStyle: 'popover' // Use popover for better UX
        });
    } else {
        window.open(url, '_blank');
    }
};

/**
 * Close the in-app browser if it's open.
 */
export const closeInAppBrowser = async (): Promise<void> => {
    if (isCapacitorNative()) {
        try {
            await Browser.close();
        } catch (e) {
            // Browser might not be open, ignore error
            console.debug('Browser.close() called but browser may not be open');
        }
    }
};

/**
 * Add a listener for deep link / app URL open events.
 * Returns a cleanup function to remove the listener.
 * 
 * @param callback - Function called with the full URL when a deep link is opened
 * @returns Cleanup function to remove the listener
 */
export const addAppUrlOpenListener = (
    callback: (url: string) => void
): (() => void) => {
    if (!isCapacitorNative()) {
        return () => { }; // No-op for web
    }

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    // Set up the listener (async, but we don't await it)
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        callback(event.url);
    }).then(handle => {
        listenerHandle = handle;
    });

    return () => {
        if (listenerHandle) {
            listenerHandle.remove();
        }
    };
};

/**
 * Parse a library installation URL from a deep link.
 * Expected format: excalidraw://library?addLibrary={url}&token={token}
 * 
 * @param url - The deep link URL to parse
 * @returns Object with libraryUrl and token if valid, null otherwise
 */
export const parseLibraryDeepLink = (url: string): {
    libraryUrl: string;
    token: string | null
} | null => {
    try {
        const parsedUrl = new URL(url);

        // Check if this is our library deep link scheme
        if (parsedUrl.protocol !== `${LIBRARY_URL_SCHEME}:`) {
            return null;
        }

        // Handle both "excalidraw://library?..." and "excalidraw://library/..."
        const host = parsedUrl.host || parsedUrl.pathname.split('/')[0];
        if (host !== LIBRARY_URL_HOST) {
            return null;
        }

        // The addLibrary parameter contains the library URL
        let libraryUrl = parsedUrl.searchParams.get('addLibrary');
        let token = parsedUrl.searchParams.get('token');

        // Check hash parameters if not found in searchParams (or to supplement them)
        if (parsedUrl.hash) {
            const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
            if (!libraryUrl) {
                libraryUrl = hashParams.get('addLibrary');
            }
            if (!token) {
                token = hashParams.get('token');
            }
        }

        if (!libraryUrl) {
            console.warn('Deep link missing addLibrary parameter:', url);
            return null;
        }

        return {
            libraryUrl: decodeURIComponent(libraryUrl),
            token
        };
    } catch (e) {
        console.error('Error parsing library deep link:', e);
        return null;
    }
};

/**
 * Add a listener specifically for library installation deep links.
 * Automatically closes the in-app browser when a library link is detected.
 * 
 * @param onLibraryUrl - Callback with the library URL and token when detected
 * @returns Cleanup function
 */
export const addLibraryDeepLinkListener = (
    onLibraryUrl: (libraryUrl: string, token: string | null) => void
): (() => void) => {
    return addAppUrlOpenListener(async (url) => {
        const parsed = parseLibraryDeepLink(url);
        if (parsed) {
            // Close the in-app browser since we got what we needed
            await closeInAppBrowser();
            onLibraryUrl(parsed.libraryUrl, parsed.token);
        }
    });
};
