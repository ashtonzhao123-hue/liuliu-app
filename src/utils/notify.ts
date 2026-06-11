import { Toast } from 'antd-mobile';

type NotifyKind = 'success' | 'error' | 'info';

const durationByKind: Record<NotifyKind, number> = {
  success: 2000,
  error: 3000,
  info: 2200
};

export function notify(content: string, kind: NotifyKind = 'info') {
  Toast.show({
    content,
    duration: durationByKind[kind],
    position: 'top'
  });
}
