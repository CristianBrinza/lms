/** sessionStorage key: the splash already played in this session (shared with splash.ts). */
export const SPLASH_SEEN_KEY = 'lms:splash-seen';

/**
 * Inline <head> script, added to index.html by vite.config.ts (which also puts its hash in the
 * CSP). It runs before the first paint and does two things:
 *
 * - It marks <html data-splash="skip"> when the page comes back within the same session (an
 *   update applied in the background, iOS reopening a paused app, a reload). The splash only
 *   plays when the app starts.
 * - In the iOS Home Screen app it lines the splash tile up with the launch image. iOS draws the
 *   launch image on the whole screen but lays the page out below the status bar, so a tile
 *   centred in the page would sit half a status bar lower. It measures that gap into
 *   --splash-status-bar and index.html moves the tile up by half of it.
 */
export const SPLASH_GATE_SCRIPT =
  'try{' +
  "var d=document.documentElement,n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];" +
  `if(sessionStorage.getItem('${SPLASH_SEEN_KEY}')||(n&&(n.type==='reload'||n.type==='back_forward'))){` +
  "d.setAttribute('data-splash','skip')" +
  '}else if(navigator.standalone){' +
  'var s=screen,g=(innerWidth>innerHeight?Math.min(s.width,s.height):Math.max(s.width,s.height))-innerHeight;' +
  "if(g>0&&g<100)d.style.setProperty('--splash-status-bar',g+'px')" +
  '}}catch(e){}';
