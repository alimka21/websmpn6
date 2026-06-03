import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const toast = {
  success: (title: string, options?: ToastOptions) =>
    sonnerToast.success(title, {
      description: options?.description,
      duration: options?.duration ?? 3000,
      action: options?.action
        ? { label: options.action.label, onClick: options.action.onClick }
        : undefined,
    }),

  error: (title: string, options?: ToastOptions) =>
    sonnerToast.error(title, {
      description: options?.description,
      duration: options?.duration ?? 5000,
    }),

  warning: (title: string, options?: ToastOptions) =>
    sonnerToast.warning(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    }),

  info: (title: string, options?: ToastOptions) =>
    sonnerToast.info(title, {
      description: options?.description,
      duration: options?.duration ?? 3000,
    }),

  loading: (title: string, options?: ToastOptions) =>
    sonnerToast.loading(title, {
      description: options?.description,
    }),

  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
};

export default toast;
