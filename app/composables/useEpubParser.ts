import ePub from 'epubjs'
import type { Book, TocItem } from 'epubjs'
import type { BookMetadata } from './useEpubState'

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

  const extractToc = async (book: Book): Promise<TocItem[]> => {
    const navigation = await book.loaded.navigation
    const toc = navigation?.toc || []
    
    // Flatten nested subitems recursively
    const flattenToc = (items: TocItem[]): TocItem[] => {
      const flattened: TocItem[] = []
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

  return {
    parseEpub,
    extractMetadata,
    extractToc,
  }
}

