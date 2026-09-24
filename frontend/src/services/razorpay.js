let razorpayLoader;

export function loadRazorpay() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout is only available in a browser.'));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpayLoader) return razorpayLoader;

  razorpayLoader = new Promise((resolve, reject) => {
    const scriptUrl = 'https://checkout.razorpay.com/v1/checkout.js';
    const existing = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existing) {
      existing.addEventListener('load', () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay test checkout is unavailable.')), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay test checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay test checkout is unavailable.'));
    script.onerror = () => reject(new Error('Unable to load Razorpay test checkout.'));
    document.body.appendChild(script);
  }).catch((error) => {
    razorpayLoader = undefined;
    throw error;
  });

  return razorpayLoader;
}