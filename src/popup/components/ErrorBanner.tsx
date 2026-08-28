import React from 'react';
import { Icon } from './Icons';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  actionLabel,
  onAction
}) => {
  return (
    <div className="error-banner" role="status">
      <span>{message}</span>
      <div className="error-banner-actions">
        {actionLabel !== undefined && onAction !== undefined && (
          <button type="button" className="error-action-button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        {onDismiss !== undefined && (
          <button
            type="button"
            className="icon-button"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
