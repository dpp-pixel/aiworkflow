// toast.js - Simple toast notification system
let toastContainer = null;
let toastId = 0;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 50000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
}

function createToast(message, type = 'info', duration = 4000) {
  ensureContainer();
  
  const id = ++toastId;
  const toast = document.createElement('div');
  
  const colors = {
    success: { bg: 'rgba(34, 197, 94, 0.9)', border: '#22c55e' },
    error: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444' },
    warning: { bg: 'rgba(245, 158, 11, 0.9)', border: '#f59e0b' },
    info: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' }
  };
  
  const color = colors[type] || colors.info;
  
  toast.style.cssText = `
    background: ${color.bg};
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border-left: 4px solid ${color.border};
    font-size: 0.875rem;
    max-width: 20rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    cursor: pointer;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  
  toast.textContent = message;
  toast.onclick = () => removeToast(toast);
  
  toastContainer.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });
  
  // Auto remove
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

function removeToast(toast) {
  if (toast && toast.parentNode) {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

export const toast = {
  success: (message, duration) => createToast(message, 'success', duration),
  error: (message, duration) => createToast(message, 'error', duration),
  warning: (message, duration) => createToast(message, 'warning', duration),
  info: (message, duration) => createToast(message, 'info', duration),
};