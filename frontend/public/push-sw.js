/*
 * LMS: reminders on the phone (web push).
 *
 * Loaded into the service worker that vite-plugin-pwa generates (workbox.importScripts in
 * vite.config.ts). The server sends JSON { title, body, url, tag }
 * (backend/src/modules/reminders/push.ts); a tap opens `url` in an LMS window, reusing one that is
 * already open.
 */
/* eslint-disable */

self.addEventListener('push', function (event) {
  var message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch (error) {
    message = { body: event.data ? event.data.text() : '' };
  }
  var title = message.title || 'LMS';
  var options = {
    body: message.body || '',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    tag: message.tag || undefined,
    renotify: false,
    data: { url: message.url || '/home', posts: {} },
  };
  // Buttons (Taken / Skip): the phone shows what it supports; a tap posts to the API.
  if (message.actions && message.actions.length) {
    options.actions = message.actions.slice(0, 2).map(function (a) {
      options.data.posts[a.action] = a.post;
      return { action: a.action, title: a.title };
    });
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var post = event.action && event.notification.data && event.notification.data.posts && event.notification.data.posts[event.action];
  if (post) {
    event.waitUntil(
      fetch(post, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }).catch(function () {
        return self.clients.openWindow(new URL((event.notification.data && event.notification.data.url) || '/home', self.location.origin).href);
      }),
    );
    return;
  }
  var target = new URL((event.notification.data && event.notification.data.url) || '/home', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      var own = windows.filter(function (win) {
        return new URL(win.url).origin === self.location.origin;
      });
      var win = own.find(function (w) { return w.focused; }) || own[0];
      if (win) {
        return win.focus().then(function (focused) {
          var client = focused || win;
          if (client.url === target || typeof client.navigate !== 'function') return client;
          return client.navigate(target).catch(function () {
            return self.clients.openWindow(target);
          });
        });
      }
      return self.clients.openWindow(target);
    }),
  );
});
