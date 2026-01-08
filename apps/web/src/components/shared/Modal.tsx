import type { ComponentChildren, JSX } from 'preact';

interface ModalProps {
  visible: boolean;
  class?: string;
  children: ComponentChildren;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLDivElement>) => void;
}

export function Modal({ visible, class: className, children, onClick }: ModalProps) {
  const baseClass = className || 'choice-modal';
  const visibleClass = visible ? 'visible' : '';

  return (
    <div class={`${baseClass} ${visibleClass}`} onClick={onClick}>
      {children}
    </div>
  );
}
