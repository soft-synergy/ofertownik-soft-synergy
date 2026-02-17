export function register(config) {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL || ''}/sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          if (config?.onSuccess) config.onSuccess(registration);
        })
        .catch((err) => {
          if (config?.onError) config.onError(err);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
}
