import { useLocation } from 'react-router';
import { isUkrainianPath, pagePath, type PublicPage } from './seo';

/** The address of a public page in the language of the page being shown: under /uk/ its Ukrainian one. */
export function usePublicPath(): (page: PublicPage) => string {
  const { pathname } = useLocation();
  const language = isUkrainianPath(pathname) ? 'uk' : 'en';
  return (page) => pagePath(page, language);
}
