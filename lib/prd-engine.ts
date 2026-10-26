import type { PilotPatient, PilotWoundAssessment, TVNPriority } from './pilot-types';
import { ACTION_BY_CODE, MAX_URGENCY_FOR_PRIORITY } from './ai/action-library';

// Deterministic implementation of the WoundCareIQ PRD prioritisation rules (sections 7.1, 8, 9, 10, 11.1-11.4).
// It is a pure function of its inputs: no clock, no randomness, stable ordering everywhere.
// It is the rule "floor" beneath the AI layer. Rules that need data the CSV does not carry are
// never guessed: they are listed in `notEvaluable`.

export const PRD_RULESET_VERSION = 'prd-1.0.0-csv';

export type TrajectoryClass =
  | 'Repeated Deterioration'
  | 'Deteriorating'
  | 'Delayed Healing'
  | 'Stable'
  | 'Improving'
  | 'Insufficient data';
export type InfectionState = 'None' | 'Active (local)';
export type PadTier = 'None' | 'Moderate';

export interface WindowResult {
  weeks: 2 | 4 | 6 | 8 | 12;
  parPct: number | null;
  valid: boolean;
  interpolated: boolean;
  baselineAreaCm2: number | null;
}
export interface RedFlag {
  id: string;
  name: string;
  trigger: string;
  actionCode: string;
}
export interface ScoreComponents {
  severity: number;
  trajectory: number;
  infection: number;
  vascular: number;
  chronicity: number;
  risk: number;
}
export interface PrdRuleResult {
  rulesetVersion: string;
  asOf: string;
  priority: TVNPriority;
  score: number;
  components: ScoreComponents;
  trajectory: TrajectoryClass;
  windows: WindowResult[];
  redFlags: RedFlag[];
  floors: string[];
  notEvaluable: { id: string; reason: string }[];
  infectionState: InfectionState;
  padTier: PadTier;
  chronicityDays: number;
  chronicityEstimated: boolean;
  primaryDriver: string;
  supportingFactors: string[];
  primaryActionCode: string;
  secondaryActionCodes: string[];
  confidence: { level: 'HIGH' | 'MEDIUM' | 'LOW'; score: number; limitingFactors: string[] };
  dataGaps: string[];
}

// ---------- helpers ----------

const MS_DAY = 86400000;
const EPS = 1e-9;

function dayNum(s: string | undefined | null): number {
  if (!s) return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
  if (!m) return NaN;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_DAY);
}
function isoOf(day: number): string {
  return new Date(day * MS_DAY).toISOString().slice(0, 10);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(day: number): string {
  const d = new Date(day * MS_DAY);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
function r1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}
function rpct(n: number): number {
  return Math.round(n);
}
function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function latestAssessmentDate(patients: PilotPatient[]): string {
  let best = NaN;
  for (let i = 0; i < patients.length; i++) {
    const as = patients[i].assessments || [];
    for (let j = 0; j < as.length; j++) {
      const d = dayNum(as[j].date);
      if (!isNaN(d) && (isNaN(best) || d > best)) best = d;
    }
  }
  return isNaN(best) ? '' : isoOf(best);
}

type WoundType = 'DFU' | 'VLU' | 'PU' | 'ARTERIAL' | 'SURGICAL' | 'OTHER';

interface Pt {
  day: number;
  area: number;
  a: PilotWoundAssessment;
}

const PLAUSIBLE_MAX_CM2 = 2000;

const WINDOWS: { weeks: 2 | 4 | 6 | 8 | 12; tol: number }[] = [
  { weeks: 2, tol: 3 },
  { weeks: 4, tol: 5 },
  { weeks: 6, tol: 7 },
  { weeks: 8, tol: 7 },
  { weeks: 12, tol: 10 },
];

interface InternalWindow extends WindowResult {
  baseDay: number | null;
  nowArea: number;
}

function classifyType(p: PilotPatient): WoundType {
  const t = (p.woundType || '').toLowerCase();
  if (p.isDiabeticFootUlcer || /diabet|\bdfu\b/.test(t)) return 'DFU';
  if (p.isPressureInjury || (p.pressureStage || 0) > 0 || /pressure|decubitus|bed ?sore/.test(t)) return 'PU';
  if (/arterial|ischaem|ischem|mixed/.test(t)) return 'ARTERIAL';
  if (/venous|\bvlu\b/.test(t)) return 'VLU';
  if (/surgical|dehisc|post-?op|incision|sutur/.test(t)) return 'SURGICAL';
  return 'OTHER';
}

function noisy(aw: number, an: number): boolean {
  return an > 0 && aw < 2 && an < 2 && Math.abs(aw - an) < 0.5;
}

// ---------- main ----------

export function evaluatePrdRules(p: PilotPatient, asOfIn?: string): PrdRuleResult {
  const notEvaluable: { id: string; reason: string }[] = [];
  const dataGaps: string[] = [];

  // --- assessments: normalise, exclude implausible, sort, dedupe by day ---
  const raw = (p.assessments || []).slice();
  let implausibleCount = 0;
  let missingDateCount = 0;
  const pts: Pt[] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    const day = dayNum(a.date);
    if (isNaN(day)) {
      missingDateCount++;
      continue;
    }
    const area = Number(a.surfaceArea);
    if (!isFinite(area) || area < 0 || area > PLAUSIBLE_MAX_CM2) {
      implausibleCount++;
      continue;
    }
    pts.push({ day, area, a });
  }
  pts.sort((x, y) => x.day - y.day || x.area - y.area);
  const series: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (series.length && series[series.length - 1].day === pts[i].day) series[series.length - 1] = pts[i];
    else series.push(pts[i]);
  }
  const allDays: number[] = raw.map((a) => dayNum(a.date)).filter((d) => !isNaN(d));
  const patientLatestDay = allDays.length ? Math.max.apply(null, allDays) : NaN;
  let asOfDay = dayNum(asOfIn);
  if (isNaN(asOfDay)) asOfDay = patientLatestDay;
  const asOf = isNaN(asOfDay) ? '' : isoOf(asOfDay);

  const wt = classifyType(p);
  const stage = p.pressureStage || 0;
  const tText = (p.woundType || '').toLowerCase();
  const unstageable = wt === 'PU' && /unstageable|deep tissue/.test(tText);
  const puCat4 = wt === 'PU' && (stage >= 4 || unstageable);
  const isLegUlcer =
    wt === 'VLU' || wt === 'ARTERIAL' || (wt === 'OTHER' && /leg|gaiter|calf|shin|ankle/.test(tText + ' ' + (p.woundLocation || '').toLowerCase()));
  const padTier: PadTier = p.pad ? 'Moderate' : 'None';
  const infectionState: InfectionState = p.infectionSigns ? 'Active (local)' : 'None';

  // --- chronicity ---
  let chronicityDays: number;
  let chronicityEstimated = false;
  if (isFinite(p.daysActive) && p.daysActive > 0) {
    chronicityDays = Math.round(p.daysActive);
  } else if (series.length && !isNaN(asOfDay)) {
    chronicityDays = Math.max(0, asOfDay - series[0].day);
    chronicityEstimated = true;
  } else {
    chronicityDays = 0;
    chronicityEstimated = true;
  }
  const chronicityPts =
    chronicityDays <= 30 ? 0 : chronicityDays <= 90 ? 3 : chronicityDays <= 180 ? 6 : chronicityDays <= 365 ? 8 : 10;

  // --- trajectory engine ---
  const nowPt = series.length ? series[series.length - 1] : null;
  const earlier = nowPt ? series.slice(0, series.length - 1).filter((x) => x.area > 0) : [];
  const windows: InternalWindow[] = WINDOWS.map((w) => {
    const base: InternalWindow = {
      weeks: w.weeks,
      parPct: null,
      valid: false,
      interpolated: false,
      baselineAreaCm2: null,
      baseDay: null,
      nowArea: nowPt ? nowPt.area : 0,
    };
    if (!nowPt) return base;
    const target = nowPt.day - 7 * w.weeks;
    let best: Pt | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < earlier.length; i++) {
      const d = Math.abs(earlier[i].day - target);
      if (d < bestDist) {
        bestDist = d;
        best = earlier[i];
      }
    }
    if (!best || bestDist > 2 * w.tol) return base;
    const par = noisy(best.area, nowPt.area) ? 0 : ((best.area - nowPt.area) / best.area) * 100;
    base.parPct = par;
    base.valid = true;
    base.interpolated = bestDist > w.tol;
    base.baselineAreaCm2 = best.area;
    base.baseDay = best.day;
    return base;
  });
  const win = (wk: number) => windows.filter((w) => w.weeks === wk)[0];

  const bench: { b4: number; b12: number; b12Text: string; b4Text: string } = (() => {
    if (wt === 'DFU') return { b4: 50, b12: 90, b4Text: '50% or more', b12Text: 'healed or 90% or more' };
    if (wt === 'VLU') return { b4: 40, b12: 80, b4Text: '40% or more', b12Text: 'healed or 80% or more' };
    if (wt === 'PU' && stage >= 3) return { b4: 30, b12: 60, b4Text: '30% or more', b12Text: '60% or more' };
    if (wt === 'PU') return { b4: 40, b12: 100, b4Text: '40% or more', b12Text: 'healed' };
    if (wt === 'SURGICAL') return { b4: 40, b12: 100, b4Text: '40% or more', b12Text: 'healed' };
    return { b4: 40, b12: 75, b4Text: '40% or more', b12Text: '75% or more' };
  })();

  // consecutive-assessment moves (used for episodes, rapid growth and the short-gap deterioration trigger)
  interface Move {
    endDay: number;
    gap: number;
    from: number;
    to: number;
    upPct: number;
    det: boolean;
  }
  const moves: Move[] = [];
  for (let i = 1; i < series.length; i++) {
    const a0 = series[i - 1];
    const a1 = series[i];
    if (a0.area <= 0) continue;
    const gap = a1.day - a0.day;
    const up = noisy(a0.area, a1.area) ? 0 : ((a1.area - a0.area) / a0.area) * 100;
    const det = (gap <= 21 && up >= 10 - EPS) || (gap <= 35 && up >= 20 - EPS);
    moves.push({ endDay: a1.day, gap, from: a0.area, to: a1.area, upPct: up, det });
  }
  let episodes = 0;
  if (nowPt) {
    const recent = moves.filter((m) => m.endDay >= nowPt.day - 84);
    let inRun = false;
    for (let i = 0; i < recent.length; i++) {
      if (recent[i].det) inRun = true;
      else if (inRun) {
        episodes++;
        inRun = false;
      }
    }
  }

  const dataPoints = series.length;
  const par2 = win(2).parPct;
  const par4 = win(4).parPct;
  const par12 = win(12).parPct;
  const lastMove = moves.length ? moves[moves.length - 1] : null;
  const detByWindow2 = par2 !== null && par2 <= -10 + EPS;
  const detByWindow4 = par4 !== null && par4 <= -20 + EPS;
  const detByMove = !!lastMove && lastMove.det;
  const deteriorationTrigger = detByWindow2 || detByWindow4 || detByMove;

  const pctUpText = (aw: number, an: number, weeksText: string) =>
    `Area up ${rpct(((an - aw) / aw) * 100)}% in ${weeksText} (${r1(aw)} to ${r1(an)} cm2)`;
  const parTextFn = (w: InternalWindow, expected: string) => {
    const par = w.parPct as number;
    if (par >= 0) return `Area reduced ${rpct(par)}% in ${w.weeks} weeks (expected ${expected})`;
    return `Area up ${rpct(-par)}% in ${w.weeks} weeks (expected a reduction of ${expected})`;
  };

  let trajectory: TrajectoryClass;
  let trajText = '';
  const openAtLeast4w = chronicityDays >= 28;
  if (dataPoints < 2 || (nowPt && earlier.length < 1)) {
    trajectory = 'Insufficient data';
    trajText = series.length <= 1 ? 'First recorded assessment: trajectory not yet available' : 'Fewer than 2 usable area measurements: trajectory not yet available';
  } else if (episodes >= 2) {
    trajectory = 'Repeated Deterioration';
    trajText = `${episodes} separate area increases of 10% or more in the last 12 weeks`;
  } else if (deteriorationTrigger) {
    trajectory = 'Deteriorating';
    if (detByWindow2) trajText = pctUpText(win(2).baselineAreaCm2 as number, nowPt!.area, '2 weeks');
    else if (detByWindow4) trajText = pctUpText(win(4).baselineAreaCm2 as number, nowPt!.area, '4 weeks');
    else {
      const m = lastMove as Move;
      trajText = pctUpText(m.from, m.to, m.gap === 14 ? '2 weeks' : `${m.gap} days`);
    }
  } else if (
    (openAtLeast4w && par4 !== null && par4 < bench.b4 - EPS) ||
    (par12 !== null && par12 < bench.b12 - EPS)
  ) {
    trajectory = 'Delayed Healing';
    if (openAtLeast4w && par4 !== null && par4 < bench.b4 - EPS) trajText = parTextFn(win(4), bench.b4Text);
    else trajText = parTextFn(win(12), bench.b12Text);
  } else {
    // reference change for "too early to judge" and fallthrough: longest valid window, else first-to-latest
    let refPar: number | null = null;
    for (let i = windows.length - 1; i >= 0; i--) {
      if (windows[i].parPct !== null) {
        refPar = windows[i].parPct;
        break;
      }
    }
    if (refPar === null && earlier.length) refPar = ((earlier[0].area - nowPt!.area) / earlier[0].area) * 100;
    const improving4 = par4 !== null && par4 >= bench.b4 - EPS;
    const improving2 = par2 !== null && par2 >= 20 - EPS;
    if (!openAtLeast4w && refPar !== null && refPar > -10 - EPS && refPar < bench.b4 - EPS) {
      trajectory = 'Stable';
    } else if (improving4 || improving2 || (!openAtLeast4w && refPar !== null && refPar >= bench.b4 - EPS)) {
      trajectory = 'Improving';
    } else {
      trajectory = 'Stable';
    }
    if (trajectory === 'Improving') {
      if (improving4) trajText = parTextFn(win(4), bench.b4Text);
      else if (improving2) trajText = `Area reduced ${rpct(par2 as number)}% in 2 weeks`;
      else trajText = `Area reduced ${rpct(refPar as number)}% since ${fmtDay(earlier[0].day)}`;
    } else {
      const ref = earlier[earlier.length - 1];
      const ch = ((nowPt!.area - ref.area) / ref.area) * 100;
      trajText = `Area ${ch > 0 ? 'up' : ch < 0 ? 'down' : 'unchanged at'} ${ch === 0 ? r1(nowPt!.area) + ' cm2' : rpct(Math.abs(ch)) + '%'} since ${fmtDay(ref.day)} (${r1(ref.area)} to ${r1(nowPt!.area)} cm2)`;
      if (ch === 0) trajText = `Area unchanged at ${r1(nowPt!.area)} cm2 since ${fmtDay(ref.day)}`;
    }
  }
  const detTraj = trajectory === 'Deteriorating' || trajectory === 'Repeated Deterioration';

  // --- red flags ---
  const redFlags: RedFlag[] = [];
  if (wt === 'DFU' && padTier !== 'None') {
    redFlags.push({
      id: 'RF-01',
      name: 'DFU with PAD',
      trigger: 'Open diabetic foot ulcer with peripheral arterial disease recorded',
      actionCode: 'URGENT_REFERRAL_DIABETIC_FOOT_MDT',
    });
  }
  notEvaluable.push({ id: 'RF-02', reason: 'Needs erythema size, lymphangitis, crepitus or systemic signs; not in the data' });
  if (puCat4 && (series.length <= 1 || detTraj)) {
    redFlags.push({
      id: 'RF-03',
      name: 'Category 4, unstageable or deep tissue pressure ulcer',
      trigger: series.length <= 1 ? 'Category 4 pressure ulcer newly recorded' : 'Category 4 pressure ulcer with deteriorating trajectory',
      actionCode: 'TVN_REVIEW_TODAY',
    });
  }
  if (puCat4) {
    notEvaluable.push({ id: 'RF-03:no-TVN-review-7d', reason: 'TVN review dates not in the data; only newly recorded and deteriorating triggers evaluated' });
  }
  // RF-04: rapid growth between assessment pairs
  {
    let rf4: string | null = null;
    if (nowPt) {
      for (let i = 0; i < series.length && !rf4; i++) {
        for (let j = i + 1; j < series.length && !rf4; j++) {
          const a0 = series[i];
          const a1 = series[j];
          if (a0.area <= 0 || a1.day < nowPt.day - 14) continue;
          const gap = a1.day - a0.day;
          if (gap < 1 || gap > 14 || noisy(a0.area, a1.area)) continue;
          const up = ((a1.area - a0.area) / a0.area) * 100;
          if ((gap <= 14 && up >= 50 - EPS) || (gap <= 7 && up >= 25 - EPS)) {
            rf4 = `Rapid wound growth: area up ${rpct(up)}% in ${gap} days (${r1(a0.area)} to ${r1(a1.area)} cm2)`;
          }
        }
      }
    }
    if (rf4) redFlags.push({ id: 'RF-04', name: 'Rapid wound growth', trigger: rf4, actionCode: 'CLINICAL_REVIEW_TODAY' });
  }
  if (infectionState !== 'None' && detTraj) {
    redFlags.push({
      id: 'RF-05',
      name: 'Infection with deterioration',
      trigger: `Infection signs recorded with ${trajectory === 'Deteriorating' ? 'deteriorating' : 'repeatedly deteriorating'} wound`,
      actionCode: 'CLINICAL_REVIEW_TODAY',
    });
  }
  notEvaluable.push({ id: 'RF-06', reason: 'Needs necrosis, gangrene, exposed bone or probe-to-bone findings; not in the data' });
  if (wt === 'DFU') notEvaluable.push({ id: 'RF-07', reason: 'MDT foot service referral status not in the data' });
  else notEvaluable.push({ id: 'RF-07', reason: 'Applies to diabetic foot ulcers only; MDT referral status not in the data' });
  notEvaluable.push({ id: 'RF-08', reason: 'Needs ABPI, toe pressure or rest pain; not in the data' });
  redFlags.sort((x, y) => x.id.localeCompare(y.id));

  // --- score components ---
  let severity: number;
  if (wt === 'PU') severity = puCat4 ? 25 : stage === 3 ? 18 : 8;
  else if (wt === 'DFU') severity = 20;
  else if (wt === 'ARTERIAL') severity = 16;
  else if (wt === 'VLU') severity = 10;
  else if (wt === 'SURGICAL') severity = /dehisc/.test(tText) ? 12 : 6;
  else severity = 6;
  severity = Math.min(25, severity);
  const trajPts: Record<TrajectoryClass, number> = {
    'Repeated Deterioration': 25,
    Deteriorating: 20,
    'Delayed Healing': 12,
    'Insufficient data': 8,
    Stable: 5,
    Improving: 0,
  };
  const infectionPts = infectionState === 'Active (local)' ? 14 : 0;
  let vascular = 0;
  if (wt === 'DFU' && padTier !== 'None') vascular = 15;
  else if (padTier !== 'None' && isLegUlcer) vascular = 10;
  else if (wt === 'DFU') vascular = 8;
  else if ((wt === 'VLU' || wt === 'ARTERIAL') && padTier === 'None') vascular = 4;
  else if (p.diabetes) vascular = 3;
  const components: ScoreComponents = {
    severity,
    trajectory: trajPts[trajectory],
    infection: infectionPts,
    vascular,
    chronicity: chronicityPts,
    risk: 0,
  };
  const score = Math.max(
    0,
    Math.min(100, Math.min(25, severity) + components.trajectory + infectionPts + vascular + chronicityPts + Math.min(5, components.risk))
  );

  // --- band ---
  const RANK: TVNPriority[] = ['SEE TODAY', 'SEE THIS WEEK', 'MONITOR', 'HEALING'];
  let baseBand: TVNPriority;
  if (score >= 65) baseBand = 'SEE TODAY';
  else if (score >= 40) baseBand = 'SEE THIS WEEK';
  else if (trajectory === 'Improving' && infectionState === 'None') baseBand = 'HEALING';
  else baseBand = 'MONITOR';
  let priority: TVNPriority = baseBand;
  const floors: string[] = [];
  if (redFlags.length) {
    priority = 'SEE TODAY';
  } else {
    const floorCands: string[] = [];
    if (detTraj || trajectory === 'Delayed Healing') floorCands.push(`Trajectory: ${trajectory}`);
    if (infectionState !== 'None') floorCands.push('Active infection');
    if (puCat4) floorCands.push('Pressure ulcer category 4');
    if (floorCands.length && RANK.indexOf(baseBand) > 1) {
      priority = 'SEE THIS WEEK';
      for (let i = 0; i < floorCands.length; i++) floors.push(floorCands[i]);
    }
  }
  if (chronicityDays > 90) {
    notEvaluable.push({ id: 'FLOOR-90D-NO-TVN-60D', reason: 'Wound open over 90 days; TVN review dates not in the data, floor not applied' });
  }
  notEvaluable.push({ id: 'RISK-FACTORS', reason: 'MUST, Braden, immunosuppression and dialysis not in the data; patient risk points scored 0' });
  notEvaluable.push({ id: 'MODIFIERS-AND-TRIGGERS', reason: 'Debridement, tissue %, depth change, undermining, pressure ulcer category change, pain, malodour and erythema not in the data' });
  notEvaluable.push({ id: 'RECURRENCE-SAME-SITE', reason: 'Wound healed-and-recurred history not in the data' });
  notEvaluable.push({ id: 'INFECTION-STATES', reason: 'Only recorded infection signs available: states Suspected, Spreading, Systemic, Resolving and Resolved not distinguishable' });

  // --- data gaps ---
  if (wt === 'DFU' || wt === 'VLU' || wt === 'ARTERIAL' || isLegUlcer) dataGaps.push('No vascular assessment recorded');
  dataGaps.push('Depth and undermining add-ons to wound severity not scored');
  dataGaps.push('Patient risk factors (MUST, Braden, immunosuppression, dialysis) not recorded');
  dataGaps.push('TVN review dates not recorded');
  if (wt === 'DFU') dataGaps.push('MDT foot service referral not recorded');
  if (wt === 'PU' && stage === 0) dataGaps.push('Pressure ulcer category not recorded');
  if (series.length <= 1) dataGaps.push('Single assessment: trajectory not yet available');
  if (implausibleCount) dataGaps.push(`${implausibleCount} implausible area value${implausibleCount > 1 ? 's' : ''} excluded`);
  if (missingDateCount) dataGaps.push(`${missingDateCount} assessment${missingDateCount > 1 ? 's' : ''} without a valid date excluded`);

  // --- confidence ---
  const lim: string[] = [];
  const nowDayForRecency = nowPt ? nowPt.day : NaN;
  const recent12 = series.filter((x) => x.area > 0 && !isNaN(asOfDay) && x.day >= asOfDay - 84 && x.day <= asOfDay);
  const nRecent = recent12.length;
  const cCount = nRecent >= 5 ? 25 : nRecent === 4 ? 22 : nRecent === 3 ? 18 : nRecent === 2 ? 12 : nRecent === 1 ? 5 : 0;
  if (nRecent < 3) lim.push(`${nRecent} assessment${nRecent === 1 ? '' : 's'} with area in the last 12 weeks`);

  const critMissing: string[] = [];
  if (!(p.woundType || '').trim()) critMissing.push('wound type');
  if (!nowPt) critMissing.push('assessment date');
  if (!(p.woundLocation || '').trim()) critMissing.push('wound location');
  const critPart = (15 * (3 - critMissing.length)) / 3;
  const latestA = nowPt ? nowPt.a : undefined;
  const important: { name: string; present: boolean }[] = [
    { name: 'exudate', present: !!(latestA && latestA.exudate) },
    { name: 'tissue type', present: !!(latestA && latestA.tissueType && String(latestA.tissueType).trim()) },
    { name: 'depth', present: isFinite(p.depth) && p.depth > 0 },
    { name: 'dimensions', present: !!(latestA && latestA.length > 0 && latestA.width > 0) },
  ];
  if (wt === 'DFU' || wt === 'VLU' || wt === 'ARTERIAL' || isLegUlcer) important.push({ name: 'vascular assessment', present: false });
  const impPresent = important.filter((x) => x.present).length;
  const cComplete = critPart + (15 * impPresent) / important.length;
  const impMissing = important.filter((x) => !x.present).map((x) => x.name);
  if (critMissing.length) lim.push(`Critical field missing: ${critMissing.join(', ')}`);
  if (impMissing.length) lim.push(`Not recorded: ${impMissing.join(', ')}`);

  const w2 = win(2);
  const w4 = win(4);
  let cTraj = 0;
  if (w2.valid && !w2.interpolated) cTraj += 10;
  else lim.push(w2.valid ? '2-week baseline interpolated' : 'No 2-week baseline assessment');
  if (w4.valid && !w4.interpolated) cTraj += 10;
  else lim.push(w4.valid ? '4-week baseline interpolated' : 'No 4-week baseline assessment');
  // Theil-Sen slope of ln(area) over the last 12 weeks (needs >= 3 points)
  const slopePts = recent12;
  let slopeK: number | null = null;
  if (slopePts.length >= 3) {
    const sl: number[] = [];
    for (let i = 0; i < slopePts.length; i++)
      for (let j = i + 1; j < slopePts.length; j++) {
        const dt = slopePts[j].day - slopePts[i].day;
        if (dt > 0) sl.push((Math.log(slopePts[j].area) - Math.log(slopePts[i].area)) / dt);
      }
    if (sl.length) slopeK = median(sl);
  }
  if (slopeK !== null) cTraj += 5;
  if (implausibleCount === 0) cTraj += 5;

  const lastGap = nowPt && !isNaN(asOfDay) ? asOfDay - nowDayForRecency : NaN;
  const cRec = isNaN(lastGap) ? 0 : lastGap <= 7 ? 15 : lastGap <= 14 ? 10 : lastGap <= 28 ? 5 : 0;
  if (!isNaN(lastGap) && lastGap > 7) lim.push(`Latest assessment ${lastGap} days before review date`);

  let cScore = Math.round(cCount + cComplete + cTraj + cRec);
  const usableCount = series.filter((x) => x.area > 0).length;
  if (usableCount <= 1) {
    cScore = Math.min(cScore, 49);
    lim.push('Single assessment: maximum LOW');
  }
  if (critMissing.length) cScore = Math.min(cScore, 74);
  const overdue = !isNaN(lastGap) && lastGap > 28;
  if (overdue) {
    cScore = Math.min(cScore, 74);
    lim.push('Overdue reassessment: latest assessment older than 28 days');
  }
  cScore = Math.max(0, Math.min(100, cScore));
  const cLevel: 'HIGH' | 'MEDIUM' | 'LOW' = cScore >= 75 ? 'HIGH' : cScore >= 50 ? 'MEDIUM' : 'LOW';

  // --- explanation ---
  interface Fact {
    key: string;
    pts: number;
    text: string;
  }
  const facts: Fact[] = [];
  facts.push({ key: 'traj', pts: components.trajectory, text: trajText });
  if (infectionPts) facts.push({ key: 'inf', pts: infectionPts, text: 'Infection signs recorded (active, local)' });
  const typeLabel =
    wt === 'DFU' ? 'Diabetic foot ulcer'
    : wt === 'PU' ? (puCat4 ? 'Category 4 or unstageable pressure ulcer' : stage ? `Category ${stage} pressure ulcer` : 'Pressure ulcer')
    : wt === 'VLU' ? 'Venous leg ulcer'
    : wt === 'ARTERIAL' ? 'Arterial or mixed leg ulcer'
    : wt === 'SURGICAL' ? 'Surgical wound'
    : 'Wound';
  facts.push({ key: 'sev', pts: severity, text: typeLabel });
  let vascText = '';
  if (vascular === 15) vascText = 'Diabetic foot ulcer with PAD recorded';
  else if (vascular === 10) vascText = 'PAD recorded with leg ulcer';
  else if (vascular === 8) vascText = 'Diabetic foot ulcer without PAD recorded';
  else if (vascular === 4) vascText = 'Leg ulcer with no vascular assessment recorded';
  else if (vascular === 3) vascText = 'Diabetes recorded with non-foot wound';
  if (vascular) facts.push({ key: 'vasc', pts: vascular, text: vascText });
  if (chronicityPts) facts.push({ key: 'chron', pts: chronicityPts, text: `Open ${chronicityDays} days${chronicityEstimated ? ' (estimated from first assessment)' : ''}` });

  let primaryDriver: string;
  const consumed: string[] = [];
  const rfTop = redFlags[0];
  if (rfTop) {
    if (rfTop.id === 'RF-01') {
      primaryDriver = 'Diabetic foot ulcer with PAD recorded';
      consumed.push('vasc', 'sev');
    } else if (rfTop.id === 'RF-03') {
      primaryDriver = rfTop.trigger;
      consumed.push('sev');
    } else if (rfTop.id === 'RF-04') {
      primaryDriver = rfTop.trigger;
      consumed.push('traj');
    } else {
      primaryDriver = `Infection signs recorded with deterioration: ${trajText.charAt(0).toLowerCase()}${trajText.slice(1)}`;
      consumed.push('inf', 'traj');
    }
  } else if (floors.length) {
    if (floors[0].indexOf('Trajectory') === 0) {
      primaryDriver = trajText;
      consumed.push('traj');
    } else if (floors[0] === 'Active infection') {
      primaryDriver = 'Infection signs recorded (active, local)';
      consumed.push('inf');
    } else {
      primaryDriver = 'Category 4 pressure ulcer';
      consumed.push('sev');
    }
  } else if (priority === 'HEALING') {
    primaryDriver = trajText;
    consumed.push('traj');
  } else {
    const order = ['sev', 'traj', 'inf', 'vasc', 'chron'];
    let top = facts[0];
    const sorted = facts.slice().sort((a, b) => b.pts - a.pts || order.indexOf(a.key) - order.indexOf(b.key));
    top = sorted[0];
    primaryDriver = top.text;
    consumed.push(top.key);
  }

  const supporting: string[] = [];
  const addSup = (t: string) => {
    if (t && supporting.indexOf(t) < 0 && t !== primaryDriver) supporting.push(t);
  };
  for (let i = 1; i < redFlags.length; i++) if (redFlags[i].id !== 'RF-05') addSup(redFlags[i].trigger);
  const compFacts = facts
    .filter((f) => f.key !== 'chron' && f.pts > 3 && consumed.indexOf(f.key) < 0)
    .sort((a, b) => b.pts - a.pts);
  for (let i = 0; i < compFacts.length; i++) addSup(compFacts[i].text);
  if (wt === 'DFU') addSup('No vascular assessment recorded');
  if (overdue) addSup(`Overdue reassessment: latest assessment ${lastGap} days before review date`);
  if (chronicityPts > 3 && consumed.indexOf('chron') < 0) addSup(`Open ${chronicityDays} days${chronicityEstimated ? ' (estimated from first assessment)' : ''}`);
  const supportingFactors = supporting.slice(0, 4);

  // --- recommendation ---
  const cands: { code: string; sec: string[] }[] = [];
  const rfAct = (id: string) => {
    if (id === 'RF-01') return { code: 'URGENT_REFERRAL_DIABETIC_FOOT_MDT', sec: ['RECORD_VASCULAR_ASSESSMENT'] };
    if (id === 'RF-03') return { code: 'TVN_REVIEW_TODAY', sec: ['CHECK_PRESSURE_RELIEVING_EQUIPMENT'] };
    if (id === 'RF-04') return { code: 'CLINICAL_REVIEW_TODAY', sec: ['REASSESS_AETIOLOGY'] };
    return { code: 'CLINICAL_REVIEW_TODAY', sec: ['REVIEW_ANTIMICROBIALS'] };
  };
  for (let i = 0; i < redFlags.length; i++) cands.push(rfAct(redFlags[i].id));
  if (trajectory === 'Repeated Deterioration') cands.push({ code: 'TVN_CASE_REVIEW_THIS_WEEK', sec: ['INCREASE_ASSESSMENT_FREQUENCY'] });
  else if (trajectory === 'Deteriorating') cands.push({ code: 'TVN_REVIEW_THIS_WEEK', sec: ['INCREASE_ASSESSMENT_FREQUENCY'] });
  else if (trajectory === 'Delayed Healing') cands.push({ code: 'TVN_REVIEW_THIS_WEEK', sec: ['CONFIRM_AETIOLOGY_AND_ABPI'] });
  if (infectionState !== 'None') cands.push({ code: 'REVIEW_FOR_INFECTION_THIS_WEEK', sec: ['INCREASE_ASSESSMENT_FREQUENCY'] });
  if (puCat4 && !redFlags.length) cands.push({ code: 'TVN_REVIEW_THIS_WEEK', sec: ['CHECK_PRESSURE_RELIEVING_EQUIPMENT'] });
  if (priority === 'SEE TODAY' && !redFlags.length) cands.push({ code: 'CLINICAL_REVIEW_TODAY', sec: [] });
  if (priority === 'SEE THIS WEEK' && !cands.length) cands.push({ code: 'TVN_CASE_REVIEW_THIS_WEEK', sec: [] });
  if (trajectory === 'Improving' && infectionState === 'None' && !cands.length) cands.push({ code: 'CONTINUE_PLAN_CONSIDER_REDUCED_VISITS', sec: [] });
  if (!cands.length) cands.push({ code: 'CONTINUE_PLAN_MEASURE_NEXT_VISIT', sec: trajectory === 'Insufficient data' ? ['MEASURE_AT_NEXT_VISIT'] : [] });
  let primary = cands[0];
  for (let i = 1; i < cands.length; i++) {
    if (ACTION_BY_CODE[cands[i].code].urgency < ACTION_BY_CODE[primary.code].urgency) primary = cands[i];
  }
  // never less urgent than the band allows
  if (ACTION_BY_CODE[primary.code].urgency > MAX_URGENCY_FOR_PRIORITY[priority]) {
    primary = priority === 'SEE TODAY' ? { code: 'CLINICAL_REVIEW_TODAY', sec: [] } : { code: 'TVN_CASE_REVIEW_THIS_WEEK', sec: [] };
  }
  const secs: string[] = [];
  const addSec = (c: string) => {
    if (c !== primary.code && secs.indexOf(c) < 0 && ACTION_BY_CODE[c]) secs.push(c);
  };
  for (let i = 0; i < primary.sec.length; i++) addSec(primary.sec[i]);
  if (wt === 'DFU') addSec('RECORD_VASCULAR_ASSESSMENT');
  if (cLevel === 'LOW') addSec('RECORD_MISSING_DATA');
  if (chronicityDays > 365) addSec('CONSIDER_BIOPSY_OR_SPECIALIST_OPINION');
  else if (chronicityDays > 180) addSec('CARE_GOAL_REVIEW');
  if (isLegUlcer && chronicityDays > 14 && chronicityDays <= 30) addSec('COMPLETE_LOWER_LIMB_ASSESSMENT');
  if (trajectory === 'Insufficient data') addSec('MEASURE_AT_NEXT_VISIT');
  const secondaryActionCodes = secs.slice(0, 2);

  return {
    rulesetVersion: PRD_RULESET_VERSION,
    asOf,
    priority,
    score,
    components,
    trajectory,
    windows: windows.map((w) => ({
      weeks: w.weeks,
      parPct: w.parPct === null ? null : Math.round(w.parPct * 10) / 10,
      valid: w.valid,
      interpolated: w.interpolated,
      baselineAreaCm2: w.baselineAreaCm2,
    })),
    redFlags,
    floors,
    notEvaluable,
    infectionState,
    padTier,
    chronicityDays,
    chronicityEstimated,
    primaryDriver,
    supportingFactors,
    primaryActionCode: primary.code,
    secondaryActionCodes,
    confidence: { level: cLevel, score: cScore, limitingFactors: lim },
    dataGaps,
  };
}
