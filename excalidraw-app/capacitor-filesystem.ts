/**
 * Capacitor Filesystem utilities for native Android file operations.
 * This module provides a bridge between the web app and native filesystem
 * when running on Capacitor (Android/iOS).
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

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
 * Save a file using Capacitor Filesystem (for Android/iOS)
 * Files are saved to the Documents directory which is accessible to the user
 */
export const saveFileNative = async (
    blob: Blob,
    fileName: string,
): Promise<{ uri: string; name: string }> => {
    // Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // Save to Documents directory (accessible to users)
    const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
    });

    return {
        uri: result.uri,
        name: fileName,
    };
};

/**
 * Save binary file (for images, etc)
 */
export const saveFileBinaryNative = async (
    blob: Blob,
    fileName: string,
): Promise<{ uri: string; name: string }> => {
    // Convert blob to base64 without the data URL prefix
    const base64Data = await blobToBase64Raw(blob);

    const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
    });

    return {
        uri: result.uri,
        name: fileName,
    };
};

/**
 * Read a file from the filesystem
 */
export const readFileNative = async (
    path: string,
): Promise<string> => {
    const result = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
    });

    // Handle both string and Blob return types
    if (typeof result.data === 'string') {
        return result.data;
    }
    // If it's a Blob, convert to string
    return await result.data.text();
};

/**
 * Delete a file from the filesystem
 */
export const deleteFileNative = async (path: string): Promise<void> => {
    await Filesystem.deleteFile({
        path,
        directory: Directory.Documents,
    });
};

/**
 * Check if a file exists
 */
export const fileExistsNative = async (path: string): Promise<boolean> => {
    try {
        await Filesystem.stat({
            path,
            directory: Directory.Documents,
        });
        return true;
    } catch {
        return false;
    }
};

/**
 * Convert Blob to base64 string (with data URL)
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Extract just the base64 data (after the comma)
            const base64 = result.split(',')[1];
            resolve(base64 || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Convert Blob to raw base64 string (without data URL prefix)
 */
const blobToBase64Raw = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Extract just the base64 data (after the comma in data URL)
            const base64 = result.split(',')[1];
            resolve(base64 || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
