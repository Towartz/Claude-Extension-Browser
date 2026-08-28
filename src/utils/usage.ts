import { HeatmapCell, ModelUsage, PeakHourlySlot, PeakStatus, UsageDashboard, UsageHistoryEntry, UsageSession } from '../types';

const MODEL_LABELS = ['All models', 'Opus', 'Sonnet', 'Haiku', 'Claude Design'];
const MODEL_KEYS = ['all', 'opus', 'sonnet', 'haiku', 'design'];
const PEAK_START_HOUR = 5;
const PEAK_END_HOUR = 11;
const TIMEZONE_PT = 'America/Los_Angeles';

export function clampPct(val: unknown): number {
  if (val === undefined || val === null) return 0;
  let num = typeof val === 'string' || typeof val === 'number' ? Number(val) : 0;
  if (!Number.isFinite(num)) return 0;
  // If Anthropic returned fraction <= 1.0 (e.g. 0.42 = 42%)
  if (num > 0 && num <= 1.0) {
    num = num * 100;
  }
  return Math.max(0, Math.min(100, num));
}

export function parseResetTimestamp(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    // If seconds epoch (10 digits), convert to ms
    const ms = val < 1e11 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) {
      const ms = num < 1e11 ? num * 1000 : num;
      return new Date(ms).toISOString();
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return null;
}

export function isRateLimitBannerText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return (
    t.includes('mencapai batas pesan') ||
    t.includes('batas akan direset') ||
    t.includes('batas pesan') ||
    t.includes('reached your message limit') ||
    t.includes('reached your usage limit') ||
    t.includes('message limit will reset') ||
    t.includes('rate limit') ||
    t.includes('resets at') ||
    t.includes('limit reached') ||
    t.includes('you have reached') ||
    (t.includes('limit') && t.includes('reset'))
  );
}

export function parseBannerResetTime(text: string, baseDate: Date = new Date()): string | null {
  if (!text || typeof text !== 'string') return null;

  // 1. Matches "pada 00.10", "at 12:10 AM", "until 15:45", "reset at 00:10", etc.
  const timeRegex = /(?:pada|at|until|sampai|reset(?:s)?(?:\s+at)?)\s*(\d{1,2})[.:](\d{2})(?:\s*(am|pm))?/i;
  let match = text.match(timeRegex);

  if (!match) {
    // Fallback: search for any "HH:MM" or "HH.MM" time in the string
    const fallbackRegex = /\b(\d{1,2})[.:](\d{2})(?:\s*(am|pm))?\b/i;
    match = text.match(fallbackRegex);
  }

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toLowerCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23) return null;

  const target = new Date(baseDate);
  target.setHours(hours, minutes, 0, 0);

  // If the target time has already passed today, roll over to tomorrow
  if (target.getTime() <= baseDate.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.toISOString();
}

export function generateModels(weeklyPct: number): ModelUsage[] {
  return MODEL_KEYS.map((key, i) => ({
    key,
    label: MODEL_LABELS[i] ?? key,
    pct: key === 'all' ? clampPct(weeklyPct) : 0
  }));
}

export function getIntensity(pct: number): number {
  return pct >= 80 ? 4 : pct >= 55 ? 3 : pct >= 30 ? 2 : pct > 0 ? 1 : 0;
}

function getPtTimeParts(date: Date): { day: number; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_PT,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { day: dayIndex >= 0 ? dayIndex : 0, hour };
}

export function getGlobalTrafficEstimate(date: Date): {
  trafficPct: number;
  level: 'low' | 'moderate' | 'high' | 'surge';
  isMajorPeak: boolean;
  isWeekend: boolean;
} {
  const { day, hour } = getPtTimeParts(date);
  const isWeekend = day === 0 || day === 6;

  let trafficPct = 20;
  let isMajorPeak = false;

  if (!isWeekend) {
    // Weekdays (Monday through Friday)
    if (hour >= PEAK_START_HOUR && hour < PEAK_END_HOUR) {
      // 5:00 AM - 1:00 PM PT: Peak overlap (US + European business day)
      isMajorPeak = true;
      if (hour >= 7 && hour <= 10) {
        trafficPct = 88;
      } else {
        trafficPct = 78;
      }
    } else if (hour >= 13 && hour < 17) {
      // 1:00 PM - 5:00 PM PT: US Afternoon steady traffic
      trafficPct = 52;
    } else if (hour >= 17 && hour < 21) {
      // 5:00 PM - 9:00 PM PT: US Evening & Asian morning start
      trafficPct = 58;
    } else {
      // 9:00 PM - 5:00 AM PT: Global Night / Off-Peak lull
      trafficPct = 20;
    }
  } else {
    // Weekends (Saturday & Sunday)
    if (hour >= 8 && hour < 15) {
      // 8:00 AM - 3:00 PM PT: Moderate weekend leisure activity
      trafficPct = 45;
    } else {
      // Very calm weekend hours
      trafficPct = 18;
    }
  }

  let level: 'low' | 'moderate' | 'high' | 'surge' = 'low';
  if (trafficPct >= 75) level = 'high';
  else if (trafficPct >= 45) level = 'moderate';
  else level = 'low';

  return { trafficPct, level, isMajorPeak, isWeekend };
}

function findNextMajorPeakTransition(date: Date, currentIsPeak: boolean): Date {
  const testDate = new Date(date.getTime());
  for (let step = 1; step <= 240; step++) {
    testDate.setMinutes(0, 0, 0);
    testDate.setHours(testDate.getHours() + 1);
    const { isMajorPeak } = getGlobalTrafficEstimate(testDate);
    if (isMajorPeak !== currentIsPeak) {
      return testDate;
    }
  }
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimeOnly(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

function getPeakWindowSchedule(): string {
  try {
    const testDate = new Date();
    let peakStart: Date | null = null;
    let peakEnd: Date | null = null;

    for (let i = 0; i < 96; i++) {
      testDate.setMinutes(0, 0, 0);
      testDate.setHours(testDate.getHours() + 1);
      const est = getGlobalTrafficEstimate(testDate);
      if (est.isMajorPeak && !peakStart) {
        peakStart = new Date(testDate.getTime());
      }
      if (!est.isMajorPeak && peakStart && !peakEnd) {
        peakEnd = new Date(testDate.getTime());
        break;
      }
    }

    if (peakStart && peakEnd) {
      return `${formatTimeOnly(peakStart)} – ${formatTimeOnly(peakEnd)} local time (Mon–Fri)`;
    }
  } catch {}
  return '05:00 – 13:00 PT (Mon–Fri)';
}

function generate24HourTimeline(now: Date): PeakHourlySlot[] {
  const currentHour = now.getHours();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const slots: PeakHourlySlot[] = [];

  for (let h = 0; h < 24; h++) {
    const slotDate = new Date(year, month, day, h, 30, 0);
    const est = getGlobalTrafficEstimate(slotDate);
    const isCurrent = h === currentHour;

    slots.push({
      hour: h,
      label: String(h).padStart(2, '0'),
      isPeak: est.isMajorPeak,
      isCurrent,
      trafficPct: est.trafficPct
    });
  }

  return slots;
}

export function calculatePeak(now: Date = new Date(), plan: string = ''): PeakStatus {
  const currentEst = getGlobalTrafficEstimate(now);
  const nextChange = findNextMajorPeakTransition(now, currentEst.isMajorPeak);
  const diffMs = Math.max(0, nextChange.getTime() - now.getTime());
  const codeUnaffected = /pro|max/i.test(plan);

  const localTime = formatTimeOnly(nextChange);
  const countdownStr = formatCountdown(diffMs);
  const scheduleStr = getPeakWindowSchedule();
  const timeline = generate24HourTimeline(now);
  const currentLocalHour = now.getHours();

  let label = '';
  let sublabel = '';
  let prediction = '';
  let tip = '';
  const trafficLevel = currentEst.level;
  const trafficPct = currentEst.trafficPct;

  if (currentEst.isMajorPeak) {
    label = 'Peak Traffic Active';
    sublabel = `High global demand · US & EU business overlap (~${trafficPct}% load)`;
    prediction = `Normalizes at ${localTime} (${countdownStr})`;
    tip = codeUnaffected
      ? 'Pro & Max accounts maintain priority bandwidth during peak hours.'
      : 'Free message quotas are stricter now. Switch accounts if rate limited.';
  } else if (currentEst.isWeekend) {
    label = 'Weekend Off-Peak Capacity';
    sublabel = `Optimal capacity · Weekend global volume is ~50% lower (~${trafficPct}% load)`;
    const weekday = nextChange.toLocaleDateString(undefined, { weekday: 'short' });
    prediction = `Next weekday peak starts ${weekday} at ${localTime} (${countdownStr})`;
    tip = 'Weekend traffic is light. Excellent window for heavy research and bulk coding.';
  } else {
    const withinTwoHours = diffMs <= 2 * 60 * 60 * 1000 && now.toDateString() === nextChange.toDateString();
    if (withinTwoHours) {
      label = 'Traffic Approaching Peak';
      sublabel = `Pre-peak ramp-up period (~${trafficPct}% load)`;
    } else {
      label = 'Optimal Capacity';
      sublabel = `Fastest responses & full quota (~${trafficPct}% load)`;
    }

    const isToday = now.toDateString() === nextChange.toDateString();
    const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === nextChange.toDateString();

    if (isToday) {
      prediction = `Peak starts today at ${localTime} (${countdownStr})`;
    } else if (isTomorrow) {
      prediction = `Peak starts tomorrow at ${localTime} (${countdownStr})`;
    } else {
      const weekday = nextChange.toLocaleDateString(undefined, { weekday: 'short' });
      prediction = `Next peak starts ${weekday} at ${localTime} (${countdownStr})`;
    }

    tip = 'Best window for complex tasks, large prompts, and long coding sessions.';
  }

  return {
    active: currentEst.isMajorPeak,
    trafficLevel,
    trafficPct,
    label,
    sublabel,
    prediction,
    nextChangeAt: nextChange.toISOString(),
    countdown: countdownStr,
    localTime,
    schedule: scheduleStr,
    tip,
    timeline,
    currentLocalHour,
    codeUnaffected
  };
}

export function calculateHeatmap(history: UsageHistoryEntry[] = [], now: number = Date.now()): HeatmapCell[] {
  const maxUsageMap = new Map<string, number>();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const item of history) {
    if (item.at < thirtyDaysAgo || item.at > now) continue;
    const pt = getPtTimeParts(new Date(item.at));
    const key = `${pt.day}:${pt.hour}`;
    maxUsageMap.set(key, Math.max(maxUsageMap.get(key) ?? 0, clampPct(item.pct)));
  }

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const usage = maxUsageMap.get(`${day}:${hour}`) ?? 0;
      cells.push({
        day,
        hour,
        intensity: getIntensity(usage)
      });
    }
  }
  return cells;
}

export function formatResetTime(resetAt: string | null, pct: number = 0): string {
  if (!resetAt) {
    if (pct <= 0) return 'Full capacity ready';
    return 'Rolling 5h window';
  }
  const time = new Date(resetAt).getTime();
  if (!Number.isFinite(time)) {
    if (pct <= 0) return 'Full capacity ready';
    return 'Rolling 5h window';
  }
  const diff = time - Date.now();
  if (diff <= 0) return 'resetting soon';
  const totalMins = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `resets in ${days}d ${remHours}h`;
  }
  return hours > 0 ? `resets in ${hours}h ${mins}m` : `resets in ${mins}m`;
}

export function formatUsageStatus(
  session?: UsageSession | null,
  now: number = Date.now()
): {
  label: string;
  pctString: string;
  timeStr: string;
  pct: number;
  status: 'normal' | 'warning' | 'danger';
} | null {
  if (!session) return null;
  const pct = Math.max(0, Math.min(100, session.pct));
  const pctString = pct > 0 && pct < 1 ? '<1' : String(Math.round(pct));
  const status: 'normal' | 'warning' | 'danger' =
    pct >= 80 ? 'danger' : pct >= 60 ? 'warning' : 'normal';

  let timeStr = '';
  if (session.resetAt) {
    const diff = new Date(session.resetAt).getTime() - now;
    if (diff <= 0) {
      timeStr = 'resetting soon';
    } else {
      const totalMins = Math.ceil(diff / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        timeStr = `resets in ${days}d ${remHours}h`;
      } else {
        timeStr = hours > 0 ? `resets in ${hours}h ${mins}m` : `resets in ${mins}m`;
      }
    }
  }

  return {
    label: timeStr ? `${pctString}% used (${timeStr})` : `${pctString}% used`,
    pctString,
    timeStr,
    pct,
    status
  };
}

export function formatRelativeDate(timestamp: number, now: number = Date.now()): string {
  const daysDiff = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));
  if (daysDiff <= 0) return 'today';
  if (daysDiff === 1) return 'yesterday';
  if (daysDiff < 7) return `${daysDiff} days ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(timestamp)
  );
}

export function formatDashboard(
  data: Partial<UsageDashboard> & { now?: Date; history?: UsageHistoryEntry[] }
): UsageDashboard {
  const now = data.now ?? new Date();
  const session = {
    pct: clampPct(data.session?.pct),
    resetAt: data.session?.resetAt ?? null
  };
  const weekly = {
    pct: clampPct(data.weekly?.pct),
    resetAt: data.weekly?.resetAt ?? null
  };
  const plan = data.plan ?? 'Unknown';

  return {
    session,
    weekly,
    models: data.models ?? generateModels(weekly.pct),
    routines: data.routines ?? null,
    plan,
    peak: calculatePeak(now, plan),
    heatmap: calculateHeatmap(data.history ?? [], now.getTime())
  };
}
