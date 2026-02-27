/**
 * Spotlight Types
 * Type definitions for the Spotlight quick chat feature
 */

export interface ClipboardContent {
  text: string | null;
  hasImage: boolean;
  imageDataUrl: string | null;
}

export type ClipboardContentType = 'text' | 'url' | 'code' | 'image' | 'empty';

export interface QuickAction {
  id: string;
  labelKey: string;
  promptPrefix: string;
}
