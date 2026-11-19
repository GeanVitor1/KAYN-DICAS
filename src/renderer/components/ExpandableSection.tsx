import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export function ExpandableSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        className="expandable-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span>{title}</span>
        </span>
        {badge ? <span className="badge badge-muted">{badge}</span> : null}
      </button>
      {open ? <div className="expandable-body">{children}</div> : null}
    </div>
  );
}
