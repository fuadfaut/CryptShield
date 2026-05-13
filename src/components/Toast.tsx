import { Info } from '@phosphor-icons/react';
import { useAppStore } from '../store/appStore';

export default function Toast() {
  const toastMessage = useAppStore((s) => s.toastMessage);

  return (
    <div
      id="toast"
      className={`toast ${toastMessage ? 'visible' : ''}`}
    >
      <Info size={20} className="mr-2" />
      <span id="toast-msg">{toastMessage || ''}</span>
    </div>
  );
}
