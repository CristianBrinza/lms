import type { ReactNode } from 'react';
import { Button, Sheet } from '@/components/ui';

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  loading?: boolean;
}

/** "Are you sure?" for actions that can't be undone in one tap. */
export function ConfirmSheet({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'default', loading }: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} fullWidth loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[0.9375rem] text-ink-700">{description}</div>
    </Sheet>
  );
}
