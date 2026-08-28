import React, { useEffect, useMemo, useState } from 'react';
import { HeatmapCell, ModelUsage, UsageDashboard, UsageSession } from '../../types';
import { formatResetTime, maskIfEmail } from '../../utils';
import { Icon } from './Icons';

const STORAGE_COLLAPSED_KEY = 'claude_usage_panel_collapsed';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCollapsedInitialState(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function getStatusColorClass(pct: number): string {
  if (pct >= 90) return 'limit';
  if (pct >= 75) return 'hot';
  if (pct >= 55) return 'warn';
  return 'ok';
}

function clampPercentage(pct: number): number {
  return Math.max(0, Math.min(100, Math.round(pct)));
}

interface GaugeCardProps {
  limit: UsageSession;
  label: string;
  statusClass: string;
  loading: boolean;
}

const GaugeCard: React.FC<GaugeCardProps> = React.memo(({ limit, label, statusClass, loading }) => {
  const rounded = Math.round(limit.pct);
  return (
    <div className="gauge-card">
      <div className={`gauge ${statusClass}`} style={{ '--pct': `${rounded}%` } as React.CSSProperties}>
        <div>
          <strong>{loading ? '--' : rounded}%</strong>
          <span>used</span>
        </div>
      </div>
      <p>{label}</p>
      <small>{formatResetTime(limit.resetAt, limit.pct)}</small>
    </div>
  );
});

interface ToolbarRingPreviewProps {
  sessionPct: number;
  weeklyPct: number;
}

const ToolbarRingPreview: React.FC<ToolbarRingPreviewProps> = React.memo(({ sessionPct, weeklyPct }) => {
  return (
    <div className="ring-preview" aria-label="Toolbar icon preview">
      <span
        style={
          {
            '--outer': `${clampPercentage(sessionPct)}%`,
            '--inner': `${clampPercentage(weeklyPct)}%`
          } as React.CSSProperties
        }
      />
      <div>
        <strong>Toolbar rings</strong>
        <small>outer session, inner weekly</small>
      </div>
    </div>
  );
});

interface LimitBarProps {
  label: string;
  limit: UsageSession;
  statusClass: string;
}

const LimitBar: React.FC<LimitBarProps> = React.memo(({ label, limit, statusClass }) => {
  return (
    <div className="limit-bar">
      <div className="section-row">
        <span>{label}</span>
        <strong>{Math.round(limit.pct)}%</strong>
      </div>
      <div className="model-track">
        <div
          className={`model-fill ${statusClass}`}
          style={{ width: `${Math.min(100, limit.pct)}%` }}
        />
      </div>
      <small>{formatResetTime(limit.resetAt, limit.pct)}</small>
    </div>
  );
});

interface HeatmapBlockProps {
  heatmap: HeatmapCell[];
}

const HeatmapBlock: React.FC<HeatmapBlockProps> = React.memo(({ heatmap }) => {
  return (
    <div className="heatmap-block">
      <div className="section-row">
        <span>Claude hours</span>
        <span>30 days</span>
      </div>
      <div className="heatmap" aria-label="Hourly Claude usage heatmap">
        {heatmap.map((cell) => (
          <span
            key={`${cell.day}-${cell.hour}`}
            className={`heat heat-${cell.intensity}`}
            title={`${DAY_NAMES[cell.day] ?? 'Day'} ${String(cell.hour).padStart(2, '0')}:00`}
          />
        ))}
      </div>
    </div>
  );
});

export interface UsagePanelProps {
  dashboard: UsageDashboard;
  loading: boolean;
  activeProfileName?: string;
  onRefresh?: () => void;
}

export const UsagePanel: React.FC<UsagePanelProps> = ({
  dashboard,
  loading,
  activeProfileName,
  onRefresh
}) => {
  const [collapsed, setCollapsed] = useState(getCollapsedInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_COLLAPSED_KEY, collapsed ? 'true' : 'false');
    } catch {}
  }, [collapsed]);

  const sessionStatusClass = useMemo(() => getStatusColorClass(dashboard.session.pct), [dashboard.session.pct]);
  const weeklyStatusClass = useMemo(() => getStatusColorClass(dashboard.weekly.pct), [dashboard.weekly.pct]);
  const hasPlan = dashboard.plan !== 'Unknown';

  return (
    <section
      className={`usage-panel ${collapsed ? 'usage-panel-collapsed' : ''}`}
      aria-label="Claude usage overview"
    >
      <div className="usage-topline">
        <div>
          <div className="usage-identity">
            <p className="eyebrow">Claude Account Switcher</p>
            {activeProfileName !== undefined && (
              <span className="active-account-badge" title={`Active account: ${activeProfileName}`}>
                {maskIfEmail(activeProfileName)}
              </span>
            )}
          </div>
          <h2>Usage overview</h2>
        </div>

        <div className="usage-actions">
          {hasPlan && <div className="plan-badge">{dashboard.plan}</div>}
          {onRefresh && (
            <button
              type="button"
              className={`usage-toggle ${loading ? 'usage-refreshing' : ''}`}
              aria-label="Refresh Claude usage"
              title="Refresh Claude usage"
              onClick={onRefresh}
              disabled={loading}
              style={{ marginRight: '4px' }}
            >
              <Icon name="refresh" size={13} className={loading ? 'spinner-icon' : ''} />
            </button>
          )}
          <button
            type="button"
            className="usage-toggle"
            aria-controls="usage-panel-body"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand usage overview' : 'Collapse usage overview'}
            title={collapsed ? 'Expand usage overview' : 'Collapse usage overview'}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} />
          </button>
        </div>
      </div>

      <div
        id="usage-panel-body"
        className={`usage-accordion ${collapsed ? 'collapsed' : ''}`}
        aria-hidden={collapsed}
      >
        <div className="usage-accordion-inner">
          <div className="usage-metrics">
            <GaugeCard
              limit={dashboard.session}
              label="5-hour session"
              statusClass={sessionStatusClass}
              loading={loading}
            />

            <div className="usage-stack">
              <ToolbarRingPreview
                sessionPct={dashboard.session.pct}
                weeklyPct={dashboard.weekly.pct}
              />

              <LimitBar
                label="7-day cap"
                limit={dashboard.weekly}
                statusClass={weeklyStatusClass}
              />

              {dashboard.routines && (
                <div className="routine-row">
                  <span>Daily routines</span>
                  <strong>
                    {dashboard.routines.used}/{dashboard.routines.limit}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {dashboard.models.length > 0 ? (
            <div className="model-breakdown">
              {dashboard.models.map((model: ModelUsage) => (
                <div key={model.key} className="model-row">
                  <span>{model.label}</span>
                  <div
                    className="model-track"
                    aria-label={`${model.label} ${Math.round(model.pct)}%`}
                  >
                    <div
                      className={`model-fill ${getStatusColorClass(model.pct)}`}
                      style={{ width: `${Math.min(100, model.pct)}%` }}
                    />
                  </div>
                  <strong>{Math.round(model.pct)}%</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="routine-row" style={{ marginTop: '10px' }}>
              <span>Free Plan</span>
              <strong style={{ fontWeight: 500, fontSize: '10px' }}>Standard message quota</strong>
            </div>
          )}

          <HeatmapBlock heatmap={dashboard.heatmap} />

          <div className="privacy-row">
            <span>Local-first storage</span>
            <span>No analytics</span>
          </div>
        </div>
      </div>
    </section>
  );
};
