import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PeakStatus } from '../../types';
import { calculatePeak } from '../../utils';
import { Icon } from './Icons';

interface PeakBannerProps {
  peak: PeakStatus;
}

export const PeakBanner: React.FC<PeakBannerProps> = React.memo(({ peak: initialPeak }) => {
  const [currentNow, setCurrentNow] = useState<Date>(() => new Date());
  const [expanded, setExpanded] = useState(true);
  const announceRef = useRef<HTMLSpanElement>(null);

  // Real-time live clock ticker: updates countdown & dynamic transitions live every second
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const livePeak = useMemo(() => {
    return calculatePeak(currentNow, initialPeak.codeUnaffected ? 'pro' : '');
  }, [currentNow, initialPeak.codeUnaffected]);

  const wasActive = useRef(livePeak.active);

  useEffect(() => {
    if (wasActive.current !== livePeak.active && announceRef.current) {
      announceRef.current.textContent = `System traffic status: ${livePeak.label}. ${livePeak.prediction}`;
    }
    wasActive.current = livePeak.active;
  }, [livePeak.active, livePeak.label, livePeak.prediction]);

  const localTimeFormatted = useMemo(() => {
    const h = String(currentNow.getHours()).padStart(2, '0');
    const m = String(currentNow.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }, [currentNow]);

  return (
    <aside
      className={`peak-banner standalone-peak-banner ${livePeak.active ? 'peak-active' : 'peak-calm'} ${
        expanded ? 'is-expanded' : ''
      }`}
      aria-label={`${livePeak.label}: ${livePeak.prediction}`}
    >
      <div className="peak-main-row" onClick={() => setExpanded((prev) => !prev)}>
        <div className="peak-content">
          <span className={`peak-badge-pill ${livePeak.active ? 'pill-active' : 'pill-calm'}`}>
            <span className="peak-indicator" aria-hidden="true" />
            <span className="peak-status-text">{livePeak.active ? 'Peak' : 'Off-Peak'}</span>
          </span>
          <div className="peak-text-group">
            <div className="peak-label-row">
              <span className="peak-label">{livePeak.label}</span>
              <span className="peak-dot" aria-hidden="true">•</span>
              <span className="peak-prediction">{livePeak.prediction}</span>
            </div>
          </div>
        </div>

        <div className="peak-right-actions">
          <button
            type="button"
            className="peak-info-toggle"
            aria-expanded={expanded}
            title={expanded ? 'Hide peak forecast details' : 'Show 24-hour peak forecast & daily schedule'}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="peak-details-pane">
          <div className="peak-timeline-wrapper">
            <div className="peak-timeline-header">
              <span>24h Local Traffic Timeline</span>
              <div className="peak-timeline-badges">
                <span className="peak-load-badge" title="Estimated global Claude traffic load">
                  Est. Load: {livePeak.trafficPct}%
                </span>
                <span className="peak-current-time-badge">
                  Local: {localTimeFormatted}
                </span>
              </div>
            </div>

            <div className="peak-timeline-bar" role="img" aria-label="24 hour traffic forecast bar">
              {livePeak.timeline.map((slot) => {
                const slotClass = slot.trafficPct >= 70 ? 'slot-peak' : slot.trafficPct >= 45 ? 'slot-moderate' : 'slot-calm';
                const typeLabel = slot.trafficPct >= 70 ? 'Major Peak' : slot.trafficPct >= 45 ? 'Moderate' : 'Optimal Calm';
                return (
                  <div
                    key={slot.hour}
                    className={`timeline-slot ${slotClass} ${slot.isCurrent ? 'slot-current' : ''}`}
                    title={`${slot.label}:00 local — ${typeLabel} (~${slot.trafficPct}% load)`}
                  >
                    {slot.isCurrent && <div className="slot-indicator-needle" />}
                  </div>
                );
              })}
            </div>

            <div className="peak-timeline-labels">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:59</span>
            </div>

            <div className="peak-legend-row">
              <span className="legend-item"><span className="legend-dot dot-calm" /> Calm (&lt;45%)</span>
              <span className="legend-item"><span className="legend-dot dot-moderate" /> Moderate</span>
              <span className="legend-item"><span className="legend-dot dot-peak" /> Major Peak (&gt;75%)</span>
            </div>
          </div>

          <div className="peak-detail-row">
            <span className="peak-detail-icon">
              <Icon name="clock" size={13} />
            </span>
            <div className="peak-detail-text">
              <strong>Daily Peak Window:</strong> <span>{livePeak.schedule}</span>
            </div>
          </div>

          <div className="peak-detail-row">
            <span className="peak-detail-icon">
              <Icon name="info" size={13} />
            </span>
            <div className="peak-detail-text">
              <span>{livePeak.tip}</span>
            </div>
          </div>
        </div>
      )}

      <span ref={announceRef} className="sr-only" role="status" aria-live="polite" />
    </aside>
  );
});