const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl);
      return;
    }

    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
};

const checkValidServiceWorker = (swUrl) => {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');

      if (response.status === 404 || (contentType && !contentType.includes('javascript'))) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
        return;
      }

      navigator.serviceWorker.register(swUrl).catch(() => {});
    })
    .catch(() => {});
};
