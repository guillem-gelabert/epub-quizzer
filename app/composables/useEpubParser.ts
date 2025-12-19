import ePub from 'epubjs'
import type { Book, NavItem, TocItem } from 'epubjs'
import type { BookMetadata } from './useEpubState'
import type Section from 'epubjs/types/section';

export const useEpubParser = () => {
  const parseEpub = async (file: File): Promise<Book> => {
    const book = ePub(file)
    await book.loaded.navigation
    return book
  } 

  const extractMetadata = async (book: Book): Promise<BookMetadata> => {
    const packageMetadata = await book.loaded.metadata

    
    const title = packageMetadata?.title || 'Untitled'
    const author =
    packageMetadata?.creator ||
    packageMetadata?.author ||
    'Unknown Author'
    
    return {
      title: typeof title === 'string' ? title : String(title || 'Untitled'),
      author: typeof author === 'string' ? author : String(author || 'Unknown Author'),
    }
  }

  const extractToc = async (book: Book): Promise<NavItem[]> => {
    const navigation = await book.loaded.navigation
    const toc = navigation?.toc || []
    
    // Flatten nested subitems recursively
    const flattenToc = (items: NavItem[]): NavItem[] => {
      const flattened: NavItem[] = []
      for (const item of items) {
        flattened.push(item)
        if (item.subitems && item.subitems.length > 0) {
          flattened.push(...flattenToc(item.subitems))
        }
      }
      return flattened
    }
    
    return flattenToc(toc)
  }

  const renderAllChapters = async (book: Book): Promise<Record<string, string>> => {
    await book.opened
    const chapters: Record<string, string> = {}
    
    if (!book.spine) {
      return chapters
    }

    // Normalize URL by removing fragment identifier
    const normalizeUrl = (url: string): string => {
      return url.split('#')[0]
    }

    // Wait for all chapters to render
    const renderPromises: Promise<void>[] = []
    book.spine.each((spineItem: Section) => {
      const normalizedUrl = normalizeUrl(spineItem.url)
      renderPromises.push(
        renderChapter(book, spineItem.url).then((content) => {
          chapters[normalizedUrl] = content
        })
      )
    })
    
    await Promise.all(renderPromises)

    console.log(chapters);
    return chapters;
  };

  const renderChapter = async (book: Book, url: string): Promise<string> => {
    await book.opened
    await book.archive.loaded
    return book.archive.getText(url)
  }

  const createTocToSpineMap = async (book: Book, tocItems: NavItem[]): Promise<Record<string, string>> => {
    await book.opened
    if (!book.spine) {
      return {}
    }

    const map: Record<string, string> = {}
    const normalizeUrl = (url: string): string => {
      const withoutFragment = url.split('#')[0]
      return withoutFragment.startsWith('/') ? withoutFragment : `/${withoutFragment}`
    }

    // Get all spine URLs with their normalized versions
    const spineItems: Array<{ original: string; normalized: string }> = []
    book.spine.each((spineItem: Section) => {
      spineItems.push({
        original: spineItem.url,
        normalized: normalizeUrl(spineItem.url)
      })
    })

    // For each ToC item, find the matching spine URL
    for (const tocItem of tocItems) {
      const normalizedTocHref = normalizeUrl(tocItem.href)
      
      // Try to resolve using book.resolve if available
      let resolvedUrl: string | null = null
      try {
        resolvedUrl = book.resolve(tocItem.href, true)
        const normalizedResolved = normalizeUrl(resolvedUrl)
        const matched = spineItems.find(item => item.normalized === normalizedResolved)
        if (matched) {
          map[normalizedTocHref] = matched.normalized
          continue
        }
      } catch (e) {
        // resolve failed, try other methods
      }
      
      // Try exact match (case-sensitive first)
      let matchedSpineUrl = spineItems.find(item => item.normalized === normalizedTocHref)
      
      // If no exact match, try case-insensitive exact match
      if (!matchedSpineUrl) {
        matchedSpineUrl = spineItems.find(item => 
          item.normalized.toLowerCase() === normalizedTocHref.toLowerCase()
        )
      }
      
      // If still no match, try basename matching (filename only)
      if (!matchedSpineUrl) {
        const tocBasename = normalizedTocHref.split('/').pop()?.toLowerCase()
        if (tocBasename) {
          matchedSpineUrl = spineItems.find(item => {
            const spineBasename = item.normalized.split('/').pop()?.toLowerCase()
            return spineBasename === tocBasename
          })
        }
      }

      if (matchedSpineUrl) {
        map[normalizedTocHref] = matchedSpineUrl.normalized
      } else {
        console.warn(`No spine match found for ToC item: ${tocItem.label} (href: ${tocItem.href}, normalized: ${normalizedTocHref})`)
      }
    }
    
    console.log('ToC to Spine mapping:', map)

    return map
  }

  return {
    parseEpub,
    extractMetadata,
    extractToc,
    renderAllChapters,
    renderChapter,
    createTocToSpineMap,
  };
};