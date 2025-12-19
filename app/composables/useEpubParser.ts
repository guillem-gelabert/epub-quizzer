import ePub from 'epubjs'
import type { Book } from 'epubjs'
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


  return {
    parseEpub,
    extractMetadata,
  }
}

