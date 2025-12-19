import "epubjs";

declare module "epubjs" {
  export interface Metadata {
    title?: string | string[];
    creator?: string | string[];
    author?: string | string[];
    contributor?: string | string[];
    [key: string]: unknown;
  }

  export interface Package {
    metadata?: Metadata;
  }

  export interface TocItem {
    id: string;
    label: string;
    href: string;
    subitems?: TocItem[];
  }

  export interface Navigation {
    toc?: TocItem[];
  }

  export interface Section {
    body: string;
    cfiBase?: string;
  }

  export interface Range {
    toString(): string;
  }

  export interface Book {
    ready: Promise<void>;
    opened: Promise<Book>;
    loaded: {
      metadata: Promise<Metadata>;
      navigation: Promise<Navigation>;
    };
    packaging?: {
      metadata?: Metadata;
    };
    navigation?: Navigation;
    section(href: string): Section;
    load(href: string): Promise<Section>;
    getRange(cfi: string): Promise<Range>;
    spine?: {
      get(index: number): {
        href: string;
        cfiBase?: string;
        render(): Promise<string>;
      };
      length: number;
    };
  }

  export default function ePub(url: string | File | Blob): Book;
}
