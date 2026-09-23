
import { SITE_CONFIG } from './baseConfig';


export default function initPageTitle() {
  const currentRoute = window.router?.currentRoute?.value;
  if (!currentRoute?.meta?.titleKey && (!document.title || document.title === 'chonglangban')) {
    document.title = SITE_CONFIG.siteName;
  }
}
