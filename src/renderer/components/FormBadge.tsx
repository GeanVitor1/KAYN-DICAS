import { Scale, Shield, Zap } from 'lucide-react';
import type { ConfidenceLevel, KaynFormChoice } from '../../shared/types';

export function FormBadge({
  form,
  label,
}: {
  form: KaynFormChoice;
  label?: string;
}) {
  if (form === 'blue') {
    return (
      <span className="badge badge-blue">
        <Zap size={13} aria-hidden="true" />
        <span>{label ?? 'Kayn Azul'}</span>
      </span>
    );
  }
  if (form === 'red') {
    return (
      <span className="badge badge-red">
        <Shield size={13} aria-hidden="true" />
        <span>{label ?? 'Rhaast'}</span>
      </span>
    );
  }
  return (
    <span className="badge badge-amber">
      <Scale size={13} aria-hidden="true" />
      <span>{label ?? 'Decisão em aberto'}</span>
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const cls =
    level === 'alta' ? 'badge-green' : level === 'media' ? 'badge-amber' : 'badge-red';
  const text =
    level === 'alta' ? 'Confiança Alta' : level === 'media' ? 'Confiança Média' : 'Confiança Baixa';
  return <span className={`badge ${cls}`}>{text}</span>;
}
