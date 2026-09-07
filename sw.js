const CACHE_VERSION = 'ielts-v48';
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const APP_SHELL = [
  '/',
  '/listening',
  '/reading',
  '/speaking',
  '/writing',
  '/books',
  '/login',
  '/account',
  '/mock',
  '/mock-results',
  '/assets/header-enhance.css',
  '/assets/attempt-modal.css',
  '/assets/writing-test.css',
  '/assets/reading-full-test-1def1d0b.css',
  '/assets/reading-full-test-3cc44e7b.css',
  '/assets/reading-full-test-4dbc6c28.css',
  '/assets/reading-full-test-5a093929.css',
  '/assets/reading-full-test-68e80438.css',
  '/assets/reading-full-test-954603a2.css',
  '/assets/reading-full-test-a29fdd45.css',
  '/assets/reading-full-test-b25b4923.css',
  '/assets/reading-full-test-ccebef0c.css',
  '/assets/reading-full-test-f344fee3.css',
  '/assets/listening-full-test-2e18f804.css',
  '/assets/listening-full-test-66becd9e.css',
  '/assets/listening-full-test-84eb405b.css',
  '/assets/listening-full-test-871a9b13.css',
  '/assets/listening-full-test-a381051e.css',
  '/assets/listening-full-test-a4bb1c76.css',
  '/assets/listening-full-test-b69ffeda.css',
  '/assets/listening-full-test-b941502f.css',
  '/assets/listening-full-test-bdfc9223.css',
  '/assets/listening-full-test-c6a270cf.css',
  '/assets/listening-full-test-cde038db.css',
  '/assets/listening-section-test-173b3c95.css',
  '/assets/listening-section-test-182d601b.css',
  '/assets/listening-section-test-2524005f.css',
  '/assets/listening-section-test-2cca46bb.css',
  '/assets/listening-section-test-36e9ca6f.css',
  '/assets/listening-section-test-51b22698.css',
  '/assets/listening-section-test-5aefd824.css',
  '/assets/listening-section-test-6978e8fa.css',
  '/assets/listening-section-test-6af3a549.css',
  '/assets/listening-section-test-7358206a.css',
  '/assets/listening-section-test-79c89193.css',
  '/assets/listening-section-test-84f5f49f.css',
  '/assets/listening-section-test-86c44e3d.css',
  '/assets/listening-section-test-8787c9c6.css',
  '/assets/listening-section-test-95a685ec.css',
  '/assets/listening-section-test-9742c1ab.css',
  '/assets/listening-section-test-9831ef04.css',
  '/assets/listening-section-test-9eec0316.css',
  '/assets/listening-section-test-bfed198d.css',
  '/assets/listening-section-test-d54dcd39.css',
  '/assets/listening-section-test-d772734d.css',
  '/assets/listening-section-test-dbfd8a4a.css',
  '/assets/listening-section-test-e75235e2.css',
  '/assets/listening-section-test-ebd32d8d.css',
  '/assets/listening-section-test-ed54b9a2.css',
  '/assets/listening-section-test-fb099e7c.css',
  '/assets/reading-passage-test-210dc1c7.css',
  '/assets/reading-passage-test-55869950.css',
  '/assets/reading-passage-test-61bd57a3.css',
  '/assets/reading-passage-test-65f7d52d.css',
  '/assets/reading-passage-test-95041911.css',
  '/assets/reading-passage-test-a0457505.css',
  '/assets/reading-passage-test-b87f10fa.css',
  '/assets/reading-passage-test-baf7ff92.css',
  '/assets/reading-passage-test-c875c78a.css',
  '/assets/reading-passage-test-e060269e.css',
  '/assets/reading-passage-test-f1e03627.css',
  '/assets/reading-passage-test-f6ab581b.css',
  '/assets/header-enhance.js',
  '/assets/attempt-modal.js',
  '/assets/writing-test-engine.js',
  '/assets/reading-full-test-engine.js',
  '/assets/listening-full-test-script-02dcd376.js',
  '/assets/listening-full-test-script-08c2dabf.js',
  '/assets/listening-full-test-script-216a5880.js',
  '/assets/listening-full-test-script-274779ec.js',
  '/assets/listening-full-test-script-28773309.js',
  '/assets/listening-full-test-script-3a21470d.js',
  '/assets/listening-full-test-script-42b8e21a.js',
  '/assets/listening-full-test-script-4385a772.js',
  '/assets/listening-full-test-script-514e9611.js',
  '/assets/listening-full-test-script-58c01ff4.js',
  '/assets/listening-full-test-script-6186aaa2.js',
  '/assets/listening-full-test-script-77931ef6.js',
  '/assets/listening-full-test-script-7e78008d.js',
  '/assets/listening-full-test-script-7ee6e8ec.js',
  '/assets/listening-full-test-script-8162bb60.js',
  '/assets/listening-full-test-script-84709b9f.js',
  '/assets/listening-full-test-script-9374666e.js',
  '/assets/listening-full-test-script-a0f7840a.js',
  '/assets/listening-full-test-script-a394a3e6.js',
  '/assets/listening-full-test-script-a7ffc824.js',
  '/assets/listening-full-test-script-a99c6277.js',
  '/assets/listening-full-test-script-ac63f494.js',
  '/assets/listening-full-test-script-b0be32fe.js',
  '/assets/listening-full-test-script-b1f8ea0e.js',
  '/assets/listening-full-test-script-b982d87d.js',
  '/assets/listening-full-test-script-bada09d8.js',
  '/assets/listening-full-test-script-bba3e7a1.js',
  '/assets/listening-full-test-script-bff7036b.js',
  '/assets/listening-full-test-script-c4f72031.js',
  '/assets/listening-full-test-script-d9e83304.js',
  '/assets/listening-full-test-script-7a4b9cd2.js',
  '/assets/listening-full-test-script-3c8e5fa6.js',
  '/assets/listening-full-test-script-be71c205.js',
  '/assets/listening-full-test-script-f5a86d04.js',
  '/assets/Listenin test 33.png',
  '/assets/Listening test 34.jpg',
  '/assets/Listening test 36.png',
  '/assets/Listening test 37.png',
  '/assets/listening-full-test-script-d60a89ae.js',
  '/assets/listening-full-test-script-dc03c7cb.js',
  '/assets/listening-full-test-script-e284ace8.js',
  '/assets/listening-section-test-script-0104628d.js',
  '/assets/listening-section-test-script-029c7b2e.js',
  '/assets/listening-section-test-script-047b0113.js',
  '/assets/listening-section-test-script-05c2e4d6.js',
  '/assets/listening-section-test-script-09f1a2a7.js',
  '/assets/listening-section-test-script-0ea13932.js',
  '/assets/listening-section-test-script-10c9925a.js',
  '/assets/listening-section-test-script-114b261e.js',
  '/assets/listening-section-test-script-12b042a7.js',
  '/assets/listening-section-test-script-12b145cc.js',
  '/assets/listening-section-test-script-1598ae05.js',
  '/assets/listening-section-test-script-15fd9a8b.js',
  '/assets/listening-section-test-script-26c428b0.js',
  '/assets/listening-section-test-script-274e090c.js',
  '/assets/listening-section-test-script-373de849.js',
  '/assets/listening-section-test-script-39204c0a.js',
  '/assets/listening-section-test-script-3e48c938.js',
  '/assets/listening-section-test-script-3f595853.js',
  '/assets/listening-section-test-script-45f5a33b.js',
  '/assets/listening-section-test-script-47569340.js',
  '/assets/listening-section-test-script-496f4ee5.js',
  '/assets/listening-section-test-script-49a9b3a4.js',
  '/assets/listening-section-test-script-4b08ea14.js',
  '/assets/listening-section-test-script-4d00cb07.js',
  '/assets/listening-section-test-script-519a21e2.js',
  '/assets/listening-section-test-script-52d24743.js',
  '/assets/listening-section-test-script-5390c625.js',
  '/assets/listening-section-test-script-54f0847d.js',
  '/assets/listening-section-test-script-5d5e17a5.js',
  '/assets/listening-section-test-script-5e1c4ae4.js',
  '/assets/listening-section-test-script-5e82ebff.js',
  '/assets/listening-section-test-script-61edee9d.js',
  '/assets/listening-section-test-script-6391173f.js',
  '/assets/listening-section-test-script-68a626ab.js',
  '/assets/listening-section-test-script-6aeb1f8e.js',
  '/assets/listening-section-test-script-6c92fe39.js',
  '/assets/listening-section-test-script-6f04907b.js',
  '/assets/listening-section-test-script-71287997.js',
  '/assets/listening-section-test-script-76ad3d44.js',
  '/assets/listening-section-test-script-79eb8195.js',
  '/assets/listening-section-test-script-828f852d.js',
  '/assets/listening-section-test-script-88ad19c2.js',
  '/assets/listening-section-test-script-8a70a7dc.js',
  '/assets/listening-section-test-script-90acfd88.js',
  '/assets/listening-section-test-script-993514fc.js',
  '/assets/listening-section-test-script-9d76f662.js',
  '/assets/listening-section-test-script-9f0dd1ec.js',
  '/assets/listening-section-test-script-a061a076.js',
  '/assets/listening-section-test-script-a43cf537.js',
  '/assets/listening-section-test-script-a96d1b5e.js',
  '/assets/listening-section-test-script-aa8e95e1.js',
  '/assets/listening-section-test-script-af6a3a3c.js',
  '/assets/listening-section-test-script-afe6f4e7.js',
  '/assets/listening-section-test-script-b096b284.js',
  '/assets/listening-section-test-script-b0b632e3.js',
  '/assets/listening-section-test-script-b233ffb8.js',
  '/assets/listening-section-test-script-b2b36e23.js',
  '/assets/listening-section-test-script-bfa371da.js',
  '/assets/listening-section-test-script-c5cdf867.js',
  '/assets/listening-section-test-script-c85a9956.js',
  '/assets/listening-section-test-script-ceee8a34.js',
  '/assets/listening-section-test-script-cf3624a8.js',
  '/assets/listening-section-test-script-cf5ee234.js',
  '/assets/listening-section-test-script-dbca6bcc.js',
  '/assets/listening-section-test-script-dea9d91e.js',
  '/assets/listening-section-test-script-df1bf458.js',
  '/assets/listening-section-test-script-e036f2c2.js',
  '/assets/listening-section-test-script-e21d07e0.js',
  '/assets/listening-section-test-script-ea68b04c.js',
  '/assets/listening-section-test-script-ec95b8f9.js',
  '/assets/listening-section-test-script-ed31f071.js',
  '/assets/listening-section-test-script-f07c32ab.js',
  '/assets/reading-passage-test-script-009ab467.js',
  '/assets/reading-passage-test-script-01ca0998.js',
  '/assets/reading-passage-test-script-033b9193.js',
  '/assets/reading-passage-test-script-03dfd890.js',
  '/assets/reading-passage-test-script-047e7f7f.js',
  '/assets/reading-passage-test-script-04f85955.js',
  '/assets/reading-passage-test-script-0539ceba.js',
  '/assets/reading-passage-test-script-0a0e9e39.js',
  '/assets/reading-passage-test-script-0a1d7185.js',
  '/assets/reading-passage-test-script-0adab57d.js',
  '/assets/reading-passage-test-script-0c02c9f8.js',
  '/assets/reading-passage-test-script-0cdc0383.js',
  '/assets/reading-passage-test-script-10ce0d1d.js',
  '/assets/reading-passage-test-script-127d1a7f.js',
  '/assets/reading-passage-test-script-137a2e74.js',
  '/assets/reading-passage-test-script-1505124d.js',
  '/assets/reading-passage-test-script-1608c448.js',
  '/assets/reading-passage-test-script-1855d8a7.js',
  '/assets/reading-passage-test-script-18bd8535.js',
  '/assets/reading-passage-test-script-1929afc7.js',
  '/assets/reading-passage-test-script-1e9b0beb.js',
  '/assets/reading-passage-test-script-21559d8d.js',
  '/assets/reading-passage-test-script-23542112.js',
  '/assets/reading-passage-test-script-2504e2ce.js',
  '/assets/reading-passage-test-script-2c0552a1.js',
  '/assets/reading-passage-test-script-2c5433a2.js',
  '/assets/reading-passage-test-script-2cb1883a.js',
  '/assets/reading-passage-test-script-2e806380.js',
  '/assets/reading-passage-test-script-2ff2cb8f.js',
  '/assets/reading-passage-test-script-335042c7.js',
  '/assets/reading-passage-test-script-3715904c.js',
  '/assets/reading-passage-test-script-371e97e1.js',
  '/assets/reading-passage-test-script-3a1f01fe.js',
  '/assets/reading-passage-test-script-3e10f447.js',
  '/assets/reading-passage-test-script-3e8359b6.js',
  '/assets/reading-passage-test-script-3f1fc5ad.js',
  '/assets/reading-passage-test-script-407e3610.js',
  '/assets/reading-passage-test-script-42c7dc4b.js',
  '/assets/reading-passage-test-script-43e997ba.js',
  '/assets/reading-passage-test-script-485b8786.js',
  '/assets/reading-passage-test-script-4894db17.js',
  '/assets/reading-passage-test-script-4b25bb93.js',
  '/assets/reading-passage-test-script-4c614b65.js',
  '/assets/reading-passage-test-script-590b0241.js',
  '/assets/reading-passage-test-script-5bd080ca.js',
  '/assets/reading-passage-test-script-5c13a63d.js',
  '/assets/reading-passage-test-script-5d2ede9a.js',
  '/assets/reading-passage-test-script-5da8b158.js',
  '/assets/reading-passage-test-script-642cccfd.js',
  '/assets/reading-passage-test-script-6a567944.js',
  '/assets/reading-passage-test-script-6e62aab8.js',
  '/assets/reading-passage-test-script-6ef5331c.js',
  '/assets/reading-passage-test-script-710084e4.js',
  '/assets/reading-passage-test-script-7207999f.js',
  '/assets/reading-passage-test-script-7b72d9c6.js',
  '/assets/reading-passage-test-script-823749ca.js',
  '/assets/reading-passage-test-script-83f14839.js',
  '/assets/reading-passage-test-script-84d1d571.js',
  '/assets/reading-passage-test-script-87373b84.js',
  '/assets/reading-passage-test-script-8966346c.js',
  '/assets/reading-passage-test-script-89a05a4d.js',
  '/assets/reading-passage-test-script-8c7adfc5.js',
  '/assets/reading-passage-test-script-8dddbe01.js',
  '/assets/reading-passage-test-script-8f03605d.js',
  '/assets/reading-passage-test-script-8f7c644a.js',
  '/assets/reading-passage-test-script-904b0ecc.js',
  '/assets/reading-passage-test-script-984ccad9.js',
  '/assets/reading-passage-test-script-9944fd3b.js',
  '/assets/reading-passage-test-script-9c2cd37d.js',
  '/assets/reading-passage-test-script-9c79bdec.js',
  '/assets/reading-passage-test-script-9d913c83.js',
  '/assets/reading-passage-test-script-9d9b24e7.js',
  '/assets/reading-passage-test-script-9da3cc7c.js',
  '/assets/reading-passage-test-script-9ee250ed.js',
  '/assets/reading-passage-test-script-a0396e01.js',
  '/assets/reading-passage-test-script-a20facce.js',
  '/assets/reading-passage-test-script-a48e1509.js',
  '/assets/reading-passage-test-script-aa50543d.js',
  '/assets/reading-passage-test-script-abcf101e.js',
  '/assets/reading-passage-test-script-abee81c1.js',
  '/assets/reading-passage-test-script-ac9eee74.js',
  '/assets/reading-passage-test-script-adacfcd9.js',
  '/assets/reading-passage-test-script-b053f0f2.js',
  '/assets/reading-passage-test-script-b088c927.js',
  '/assets/reading-passage-test-script-b12e6091.js',
  '/assets/reading-passage-test-script-b142f723.js',
  '/assets/reading-passage-test-script-b2d823ad.js',
  '/assets/reading-passage-test-script-b3944e6b.js',
  '/assets/reading-passage-test-script-b6341789.js',
  '/assets/reading-passage-test-script-b7d4205a.js',
  '/assets/reading-passage-test-script-b9c005e1.js',
  '/assets/reading-passage-test-script-bca98ff1.js',
  '/assets/reading-passage-test-script-c001fad7.js',
  '/assets/reading-passage-test-script-ccf8c6cd.js',
  '/assets/reading-passage-test-script-d03e4687.js',
  '/assets/reading-passage-test-script-d15663f3.js',
  '/assets/reading-passage-test-script-d53d149c.js',
  '/assets/reading-passage-test-script-d8431d20.js',
  '/assets/reading-passage-test-script-d9ab9e94.js',
  '/assets/reading-passage-test-script-db0e701a.js',
  '/assets/reading-passage-test-script-dd5375ed.js',
  '/assets/reading-passage-test-script-de471eae.js',
  '/assets/reading-passage-test-script-e0f381a8.js',
  '/assets/reading-passage-test-script-e196f292.js',
  '/assets/reading-passage-test-script-e258e054.js',
  '/assets/reading-passage-test-script-e2f45b3a.js',
  '/assets/reading-passage-test-script-e3676f55.js',
  '/assets/reading-passage-test-script-e37a74b2.js',
  '/assets/reading-passage-test-script-e48d2a32.js',
  '/assets/reading-passage-test-script-eacd2fb0.js',
  '/assets/reading-passage-test-script-eaf76aa1.js',
  '/assets/reading-passage-test-script-eb9aa97b.js',
  '/assets/reading-passage-test-script-ec140e56.js',
  '/assets/reading-passage-test-script-edf08f07.js',
  '/assets/reading-passage-test-script-ef8f0a29.js',
  '/assets/reading-passage-test-script-f606d1c3.js',
  '/assets/reading-passage-test-script-f927dcd7.js',
  '/assets/reading-passage-test-script-fa844343.js',
  '/assets/reading-passage-test-script-fd3e4bde.js',
  '/assets/reading-passage-test-script-fe78d641.js',
  '/assets/reading-passage-test-script-ff12e5ef.js',
  '/assets/progress-tracker.js',
  '/assets/brand-logo.png'
];

self.addEventListener('install', (event) => {
  // Use individual cache.add() so a single missing/renamed asset (common with
  // hashed filenames) doesn't fail the whole install and leave the SW unactivated.
  event.waitUntil(
    caches.open(ASSET_CACHE)
      .then((cache) => Promise.allSettled(
        APP_SHELL
          .filter((url) => !isProtectedCacheEntry(new URL(url, self.location.origin).pathname))
          .map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== PAGE_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      )
    )
      .then(() => Promise.all([caches.open(PAGE_CACHE), caches.open(ASSET_CACHE)]))
      .then((cachesToClean) => Promise.all(cachesToClean.map((cache) => cache.keys().then((requests) =>
        Promise.all(
          requests
            .filter((request) => isProtectedCacheEntry(new URL(request.url).pathname))
            .map((request) => cache.delete(request))
        )
      ))))
      .then(() => self.clients.claim())
  );
});

function normalizePathname(pathname) {
  const raw = String(pathname || '');
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch (e) {
    return raw.toLowerCase();
  }
}

function isProtectedMaterialPage(pathname) {
  const path = normalizePathname(pathname);
  if (path === '/speaking' || path === '/speaking.html' || path === '/books' || path === '/books.html') return true;
  const isMaterialPath = path.startsWith('/reading/') || path.startsWith('/listening/') || path.startsWith('/writing/') || path.startsWith('/speaking/') || path.startsWith('/books/');
  if (!isMaterialPath) return false;
  return !/\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|mp3|m4a|mp4|wma|pdf|json|xml|txt)$/i.test(path);
}

function isMaterialDirectoryAsset(pathname) {
  const path = normalizePathname(pathname);
  const isMaterialPath = path.startsWith('/reading/') || path.startsWith('/listening/') || path.startsWith('/writing/') || path.startsWith('/speaking/') || path.startsWith('/books/');
  return isMaterialPath && /\.(?:png|jpg|jpeg|gif|svg|webp|mp3|m4a|mp4|wav|ogg|wma|pdf|doc|docx|xls|xlsx|zip|rar)$/i.test(path);
}

function isMaterialContentAsset(pathname) {
  const path = normalizePathname(pathname);
  return (
    path.startsWith('/assets/listening-full-test-script-') ||
    path.startsWith('/assets/listening-section-test-script-') ||
    path.startsWith('/assets/reading-passage-test-script-') ||
    path === '/assets/listening-full-test-fixes.js' ||
    path === '/assets/listenin test 33.png'
  );
}

function isProtectedCacheEntry(pathname) {
  return isProtectedMaterialPage(pathname) || isMaterialContentAsset(pathname) || isMaterialDirectoryAsset(pathname);
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf)$/i.test(pathname);
}

function isFreshAsset(pathname) {
  return pathname === '/assets/progress-tracker.js' ||
    pathname === '/assets/listening-full-test-fixes.js' ||
    pathname === '/assets/listening-section-progress.js' ||
    pathname === '/sw.js';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Protected pages and their content assets must go directly to the server.
  // The server owns the login, premium, device-limit and no-store checks. Not
  // calling respondWith here also prevents a transient service-worker fetch
  // failure from replacing a valid test with a synthetic error page.
  if (isMaterialContentAsset(url.pathname) || isMaterialDirectoryAsset(url.pathname)) {
    return;
  }

  if (req.mode === 'navigate') {
    if (isProtectedMaterialPage(url.pathname)) {
      return;
    }

    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(network);
          return cached;
        }

        const response = await network;
        return response || cache.match('/');
      })
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    if (isFreshAsset(url.pathname)) {
      event.respondWith(
        fetch(req, { cache: 'no-store' })
          .then((res) => {
            if (res && res.ok) {
              caches.open(ASSET_CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
            }
            return res;
          })
          .catch(() => caches.open(ASSET_CACHE).then((cache) => cache.match(req)))
      );
      return;
    }

    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});
