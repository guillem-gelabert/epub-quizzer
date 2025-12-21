import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import type { NavItem, BookMetadata } from "../../app/types/epub";
import { EPub } from "epub2";

// Type definitions for epub2 (since it may not have TypeScript types)
interface Epub2Metadata {
  title?: string;
  creator?: string;
  author?: string;
  language?: string;
  subject?: string;
  date?: string;
  description?: string;
  [key: string]: any;
}

interface Epub2TocItem {
  id?: string;
  href?: string;
  label?: string;
  title?: string;
  text?: string;
  name?: string;
  level?: number;
  order?: number;
  children?: Epub2TocItem[];
  [key: string]: any; // Allow other properties
}

interface Epub2FlowItem {
  id: string;
  href: string;
  "media-type"?: string;
  order?: number;
}

interface Epub2Book {
  metadata: Epub2Metadata;
  toc: Epub2TocItem[];
  flow: Epub2FlowItem[];
  manifest?: Array<{ id: string; href: string; "media-type": string; properties?: string }>;
  getChapterAsync(id: string): Promise<string>;
  getChapterRawAsync(id: string): Promise<string>;
  getImageAsync?(id: string): Promise<Buffer>;
  getFileAsync?(id: string): Promise<Buffer>;
}

// Re-export types from shared location
export type { NavItem, BookMetadata };

export interface ParsedSection {
  href: string;
  title?: string;
  html: string;
  sectionIndex: number;
}

/**
 * Convert Buffer or File to Buffer for epub2
 */
function toBuffer(file: File | Buffer): Buffer {
  if (file instanceof Buffer) {
    return file;
  }
  // File is a browser API, but we're on server-side, so this shouldn't happen
  // But handle it just in case
  throw new Error(
    "File objects are not supported on server-side. Use Buffer instead."
  );
}

/**
 * Create a temporary file from buffer and return its path
 * epub2 requires a file path, not a buffer
 */
async function createTempFile(buffer: Buffer): Promise<string> {
  const tempPath = join(
    tmpdir(),
    `epub-${Date.now()}-${Math.random().toString(36).substring(7)}.epub`
  );
  await writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Parse EPUB file and extract metadata
 */
export async function parseEpubMetadata(
  file: File | Buffer
): Promise<BookMetadata> {
  const buffer = toBuffer(file);

  // epub2 requires a file path, so create a temporary file
  const tempPath = await createTempFile(buffer);

  try {
    const epub = (await EPub.createAsync(
      tempPath,
      "/images/",
      "/links/"
    )) as Epub2Book;

    const title = epub.metadata?.title || "Untitled";
    const author =
      epub.metadata?.creator || epub.metadata?.author || "Unknown Author";

    return {
      title: typeof title === "string" ? title : String(title || "Untitled"),
      author:
        typeof author === "string"
          ? author
          : String(author || "Unknown Author"),
    };
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempPath);
    } catch (error) {
      // Ignore errors when cleaning up temp file
      console.warn(`Failed to delete temp file ${tempPath}:`, error);
    }
  }
}

/**
 * Extract TOC from EPUB
 */
export async function extractToc(file: File | Buffer): Promise<NavItem[]> {
  const buffer = toBuffer(file);
  const tempPath = await createTempFile(buffer);

  try {
    const epub = (await EPub.createAsync(
      tempPath,
      "/images/",
      "/links/"
    )) as Epub2Book;

    // epub2 toc is an array, may have nested structure
    const toc = epub.toc || [];
    
    // Debug: Log epub.toc to see the full structure
    console.log("epub.toc:", JSON.stringify(toc, null, 2));
    
    // Debug: Log the raw TOC structure to understand what properties are available
    if (toc.length > 0) {
      console.log("Raw TOC first item keys:", Object.keys(toc[0]));
      console.log("Raw TOC first item:", JSON.stringify(toc[0], null, 2));
      console.log("TOC length:", toc.length);
    }

    // Flatten nested subitems recursively and convert to NavItem format
    const flattenToc = (items: Epub2TocItem[]): NavItem[] => {
      const flattened: NavItem[] = [];
      for (const item of items) {
        // Try multiple possible property names for the label/title
        // epub2 might use different property names depending on EPUB version
        // Check all possible string properties
        const itemAny = item as any;
        const label = item.label || 
                     item.title || 
                     item.text || 
                     item.name || 
                     itemAny.labelText || 
                     itemAny.titleText ||
                     itemAny.textContent ||
                     itemAny.content ||
                     (typeof itemAny === 'string' ? itemAny : "") ||
                     "";
        
        // If still empty, try to get text from href or id
        const finalLabel = label || 
                          (item.href ? item.href.split('/').pop()?.replace(/\.(html|xhtml)$/i, '') || "" : "") ||
                          item.id ||
                          "";
        
        const navItem: NavItem = {
          id: item.id || item.href || "",
          label: finalLabel,
          href: item.href || "",
        };

        // Handle nested children if they exist
        if (item.children && item.children.length > 0) {
          navItem.subitems = flattenToc(item.children);
        }

        flattened.push(navItem);

        // Also add children to flattened list if they exist
        if (item.children && item.children.length > 0) {
          flattened.push(...flattenToc(item.children));
        }
      }
      return flattened;
    };

    return flattenToc(toc);
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempPath);
    } catch (error) {
      // Ignore errors when cleaning up temp file
      console.warn(`Failed to delete temp file ${tempPath}:`, error);
    }
  }
}

/**
 * Parse all sections from EPUB and extract HTML
 */
export async function parseAllSections(
  file: File | Buffer
): Promise<ParsedSection[]> {
  const buffer = toBuffer(file);
  const tempPath = await createTempFile(buffer);

  try {
    const epub = (await EPub.createAsync(
      tempPath,
      "/images/",
      "/links/"
    )) as Epub2Book;

    if (!epub.flow || epub.flow.length === 0) {
      return [];
    }

    const sections: ParsedSection[] = [];
    let sectionIndex = 0;

    // Process each flow item (chapter)
    for (const flowItem of epub.flow) {
      try {
        // Get chapter content using the flow item ID
        const html = await epub.getChapterAsync(flowItem.id);

        sections.push({
          href: flowItem.href || flowItem.id,
          title: undefined, // Could extract from HTML if needed
          html,
          sectionIndex,
        });
        sectionIndex++;
      } catch (error) {
        console.error(
          `Failed to parse section ${flowItem.id} (${flowItem.href}):`,
          error
        );
        // Continue with other sections even if one fails
      }
    }

    return sections;
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempPath);
    } catch (error) {
      // Ignore errors when cleaning up temp file
      console.warn(`Failed to delete temp file ${tempPath}:`, error);
    }
  }
}

/**
 * Extract cover image from EPUB and save to public directory
 */
export async function extractCover(
  file: File | Buffer,
  bookId: string
): Promise<string | null> {
  const buffer = toBuffer(file);
  const tempPath = await createTempFile(buffer);

  try {
    const epub = (await EPub.createAsync(
      tempPath,
      "/images/",
      "/links/"
    )) as Epub2Book;

    // Try to find cover image in manifest
    // epub2 may expose manifest in different ways, try multiple approaches
    const epubAny = epub as any;
    let manifest: any[] | null = null;
    
    if (epub.manifest && Array.isArray(epub.manifest)) {
      manifest = epub.manifest;
    } else if (epubAny.manifest && Array.isArray(epubAny.manifest)) {
      manifest = epubAny.manifest;
    } else if (epubAny._manifest && Array.isArray(epubAny._manifest)) {
      manifest = epubAny._manifest;
    }

    let coverItem: { id: string; href: string; "media-type": string } | null = null;

    if (manifest) {
      // Look for item with properties="cover-image"
      coverItem = manifest.find(
        (item: any) => item.properties === "cover-image" || item.properties?.includes("cover-image")
      ) as any;

      // If not found, look for common cover image names
      if (!coverItem) {
        const coverNames = ["cover", "cover-image", "cover.jpg", "cover.jpeg", "cover.png"];
        coverItem = manifest.find((item: any) =>
          coverNames.some((name) => 
            (item.id?.toLowerCase().includes(name) || item.href?.toLowerCase().includes(name)) &&
            (item["media-type"]?.startsWith("image/") || item.mediaType?.startsWith("image/"))
          )
        ) as any;
      }
    }

    if (!coverItem) {
      return null;
    }

    // Extract the image - try multiple methods epub2 might expose
    let imageBuffer: Buffer | null = null;
    
    try {
      if (epub.getImageAsync) {
        imageBuffer = await epub.getImageAsync(coverItem.id);
      } else if (epubAny.getImageAsync) {
        imageBuffer = await epubAny.getImageAsync(coverItem.id);
      } else if (epub.getFileAsync) {
        imageBuffer = await epub.getFileAsync(coverItem.id);
      } else if (epubAny.getFileAsync) {
        imageBuffer = await epubAny.getFileAsync(coverItem.id);
      } else if (epubAny.getFile) {
        imageBuffer = await Promise.resolve(epubAny.getFile(coverItem.id));
      }
    } catch (error) {
      console.warn(`Failed to extract cover using epub2 methods:`, error);
    }

    if (!imageBuffer) {
      return null;
    }

    // Determine file extension from media type or href
    const mediaType = coverItem["media-type"] || "";
    let extension = ".jpg";
    if (mediaType.includes("png")) {
      extension = ".png";
    } else if (mediaType.includes("jpeg") || mediaType.includes("jpg")) {
      extension = ".jpg";
    } else if (mediaType.includes("gif")) {
      extension = ".gif";
    } else {
      // Try to get extension from href
      const hrefExt = coverItem.href.split(".").pop()?.toLowerCase();
      if (hrefExt && ["jpg", "jpeg", "png", "gif", "webp"].includes(hrefExt)) {
        extension = `.${hrefExt}`;
      }
    }

    // Save to public/covers directory
    const coversDir = join(process.cwd(), "public", "covers");
    if (!existsSync(coversDir)) {
      await mkdir(coversDir, { recursive: true });
    }

    const coverFilename = `${bookId}${extension}`;
    const coverPath = join(coversDir, coverFilename);
    await writeFile(coverPath, imageBuffer);

    // Return public URL path
    return `/covers/${coverFilename}`;
  } catch (error) {
    console.warn("Failed to extract cover image:", error);
    return null;
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempPath);
    } catch (error) {
      console.warn(`Failed to delete temp file ${tempPath}:`, error);
    }
  }
}
