// Shared EPUB types used by both server and client code

export interface NavItem {
  id: string;
  label: string;
  href: string;
  subitems?: NavItem[];
}

export interface BookMetadata {
  title: string;
  author: string;
}

