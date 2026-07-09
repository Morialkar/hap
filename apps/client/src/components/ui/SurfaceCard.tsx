import type { HTMLAttributes } from 'react';

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'toolbar' | 'detail';
}

const variantClasses = {
  default: '',
  toolbar: 'hap-records-toolbar',
  detail: 'hap-detail-panel',
};

export function SurfaceCard({
  variant = 'default',
  className = '',
  children,
  ...props
}: SurfaceCardProps) {
  return (
    <div className={`card ${variantClasses[variant]} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
