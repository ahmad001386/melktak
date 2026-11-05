// Capture before the user opens More, including prompts fired during login.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.melktakInstallPrompt = event;
  window.dispatchEvent(new Event('melktak:installprompt'));
});
window.addEventListener('appinstalled', () => {
  window.melktakInstallPrompt = null;
  window.melktakAppInstalled = true;
  window.dispatchEvent(new Event('melktak:installprompt'));
});
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.error('Service Worker registration failed:', error));
  });
}
