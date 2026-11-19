import type { ComboStep, StudyKaynForm } from '../../shared/types';

export function ComboSequenceBadge({
  steps,
  form,
  compact = false,
}: {
  steps: ComboStep[];
  form: StudyKaynForm;
  compact?: boolean;
}) {
  const isRed = form === 'red';
  return (
    <div className="combo-row" aria-label="Sequência de habilidades">
      {steps.map((step, idx) => (
        <div key={`${step.key}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <div className="combo-step" title={step.note ?? step.label}>
            <span
              className={[
                'combo-keycap',
                isRed ? 'combo-keycap-red' : '',
                step.uncertain ? 'combo-keycap-uncertain' : '',
                compact ? 'combo-keycap-compact' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step.key}
              {step.uncertain ? '*' : ''}
            </span>
            {!compact && step.label ? (
              <span className="small-text muted-text" style={{ fontSize: 10.5, textAlign: 'center', maxWidth: 96 }}>
                {step.label}
              </span>
            ) : null}
          </div>
          {idx < steps.length - 1 ? (
            <span
              className={compact ? 'combo-arrow combo-arrow-compact' : 'combo-arrow'}
              aria-hidden="true"
            >
              →
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
