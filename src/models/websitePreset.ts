/**
 * Website Preset model for site selection and auto-fill suggestions
 */
export interface WebsitePreset {
  id: string;
  name: string;              // Display name
  aliases: string[];         // Search keywords (Korean/English)
  icon?: string;             // Future icon support
  websiteUrl: string;        // Login URL for autofill
  domain: string;            // Normalized domain for autofill matching
  category?: string;         // Category for grouping (e.g., "email", "social", "shopping")
  packageNames?: string[];   // Android app package names for native app autofill
}