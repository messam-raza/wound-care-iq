import type {
  RawRow,
  ColumnMapping,
  TargetField,
  ImportedPatient,
  DataQualityFlag,
} from './import-types';

// ─── CSV Parser ───────────────────────────────────────────────────────────────

export function parseCSV(text: string): { headers: string[]; rows: RawRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCSVLine(lines[0]);
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.every((v) => !v.trim())) continue;
    const row: RawRow = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Intelligent Column Mapper ────────────────────────────────────────────────

const FIELD_PATTERNS: Record<TargetField, RegExp[]> = {
  patientId: [/patient.?id/i, /patient.?num/i, /id$/i, /ref.?no/i],
  nhsNumber: [/nhs/i],
  patientName: [/patient.?name/i, /^name$/i, /full.?name/i, /resident.?name/i, /service.?user/i],
  facility: [/facility/i, /home.?name/i, /site/i, /location.?name/i, /ward/i, /unit/i, /care.?home/i, /organisation/i],
  clinician: [/clinician/i, /nurse/i, /therapist/i, /staff/i, /assigned/i, /key.?worker/i, /practitioner/i],
  woundType: [/wound.?type/i, /ulcer.?type/i, /wound.?class/i, /injury.?type/i, /type.?of.?wound/i],
  woundLocation: [/wound.?loc/i, /location/i, /wound.?site/i, /body.?site/i, /anatomical/i],
  length: [/^length/i, /wound.?length/i, /len.?cm/i],
  width: [/^width/i, /wound.?width/i, /wid.?cm/i],
  depth: [/^depth/i, /wound.?depth/i, /dep.?cm/i],
  woundSize: [/wound.?area/i, /wound.?size/i, /surface.?area/i, /area.?cm/i, /size.?cm/i],
  // Checked before assessmentDate so 'Last_Review_Date' is not mistaken for the assessment date.
  lastReviewDate: [/last.?review/i, /prev.?assess/i, /previous.?date/i, /last.?visit/i],
  assessmentDate: [/assessment.?date/i, /assess.?date/i, /visit.?date/i, /review.?date/i, /date.?of.?assess/i],
  diabetes: [/diabet/i, /dm\b/i, /type.?2/i],
  pad: [/\bpad\b/i, /peripher/i, /vascular/i, /pvd/i, /arterial/i],
  pressureStage: [/pressure.?stage/i, /stage/i, /grade/i, /category/i],
  infectionSigns: [/infect/i, /pyrexia/i, /wound.?infect/i, /sign.?of.?infect/i],
  age: [/\bage\b/i, /age.?year/i, /dob/i],
  gender: [/gender/i, /sex\b/i, /male.?female/i],
  missedReviews: [/missed.?review/i, /overdue/i, /missed.?visit/i],
};

export function suggestMappings(headers: string[]): ColumnMapping[] {
  return headers.map((header) => {
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(header)) {
          return { csvColumn: header, targetField: field as TargetField };
        }
      }
    }
    return { csvColumn: header, targetField: '' };
  });
}

// ─── Row → ImportedPatient converter ────────────────────────────────────────

function parseBool(val: string): boolean {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return v === 'yes' || v === 'true' || v === '1' || v === 'y';
}

function parseNum(val: string, fallback = 0): number {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function parseDate(val: string): string {
  if (!val) return '';
  const cleaned = val.trim();
  // Try parsing various formats
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString();
  // UK format dd/mm/yyyy
  const ukMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const d2 = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return '';
}

function daysBetween(isoA: string, isoB: string): number {
  if (!isoA || !isoB) return 0;
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(Math.round((b - a) / 86400000));
}

function deriveHealingTrend(areaChangePct: number): 'Improving' | 'Stalled' | 'Deteriorating' {
  if (areaChangePct <= -10) return 'Improving';
  if (areaChangePct >= 10) return 'Deteriorating';
  return 'Stalled';
}

export function transformRows(
  rows: RawRow[],
  mappings: ColumnMapping[],
): ImportedPatient[] {
  const fieldToColumn: Partial<Record<TargetField, string>> = {};
  for (const m of mappings) {
    if (m.targetField) {
      fieldToColumn[m.targetField] = m.csvColumn;
    }
  }

  const get = (row: RawRow, field: TargetField): string =>
    fieldToColumn[field] ? (row[fieldToColumn[field]!] ?? '') : '';

  // Trajectory inputs come only from the uploaded rows: rows are grouped by patient
  // and ordered by assessment date, so each row's previous area and the days observed
  // are real values, never estimates.
  const patientIdOf = (row: RawRow, idx: number) =>
    get(row, 'patientId') || get(row, 'nhsNumber') || `IMP-${String(idx + 1).padStart(4, '0')}`;
  const areaOf = (row: RawRow) => {
    const a = parseNum(get(row, 'woundSize'));
    const l = parseNum(get(row, 'length'));
    const w = parseNum(get(row, 'width'));
    return a || (l && w ? Math.round(l * w * 100) / 100 : 0);
  };
  const history = new Map<string, { idx: number; time: number | null; area: number }[]>();
  rows.forEach((row, idx) => {
    const date = parseDate(get(row, 'assessmentDate'));
    const key = patientIdOf(row, idx);
    const list = history.get(key) || [];
    list.push({ idx, time: date ? new Date(date).getTime() : null, area: areaOf(row) });
    history.set(key, list);
  });
  const previousArea = new Map<number, number>();
  const daysObserved = new Map<number, number>();
  Array.from(history.values()).forEach((list) => {
    const dated = list
      .filter((e) => e.time !== null)
      .sort((a, b) => (a.time as number) - (b.time as number) || a.idx - b.idx);
    dated.forEach((e, i) => {
      if (i > 0) previousArea.set(e.idx, dated[i - 1].area);
      daysObserved.set(e.idx, Math.round(((e.time as number) - (dated[0].time as number)) / 86400000));
    });
  });

  return rows.map((row, idx) => {
    const patientId = patientIdOf(row, idx);
    const name = get(row, 'patientName') || 'Unknown Patient';
    const facility = get(row, 'facility') || 'Unknown Facility';
    const clinician = get(row, 'clinician') || 'Unassigned';
    const woundType = get(row, 'woundType') || 'Unknown';
    const woundLocation = get(row, 'woundLocation') || 'Unknown';

    const length = parseNum(get(row, 'length'));
    const width = parseNum(get(row, 'width'));
    const depth = parseNum(get(row, 'depth'));
    let surfaceArea = parseNum(get(row, 'woundSize'));
    if (!surfaceArea && length && width) surfaceArea = Math.round(length * width * 100) / 100;

    const assessmentDate = parseDate(get(row, 'assessmentDate'));
    const lastReviewDate = parseDate(get(row, 'lastReviewDate')) || '';

    const diabetes = parseBool(get(row, 'diabetes'));
    const pad = parseBool(get(row, 'pad'));
    const infectionSigns = parseBool(get(row, 'infectionSigns'));
    const pressureStage = parseNum(get(row, 'pressureStage'));
    const missedReviews = parseNum(get(row, 'missedReviews'));
    const age = parseNum(get(row, 'age'));
    const gender = get(row, 'gender') || '';

    // Days between this patient's first and this assessment in the file. The CSV carries
    // no wound onset date, so this is a lower bound on wound age; 0 means a single assessment.
    const daysActive = daysObserved.get(idx) ?? 0;

    const prevArea = previousArea.get(idx) ?? 0;
    const areaChangePct = prevArea > 0 && surfaceArea > 0
      ? Math.round(((surfaceArea - prevArea) / prevArea) * 100)
      : 0;

    const healingTrend = deriveHealingTrend(areaChangePct);
    // Data quality flags
    const flags: DataQualityFlag[] = [];
    if (!get(row, 'patientName')) flags.push('missing_name');
    if (!get(row, 'facility')) flags.push('missing_facility');
    if (!surfaceArea && (!length || !width)) flags.push('missing_measurements');
    if (!get(row, 'assessmentDate')) flags.push('missing_assessment_date');
    if (!get(row, 'woundType')) flags.push('missing_wound_type');
    if (!get(row, 'clinician')) flags.push('missing_clinician');
    if (lastReviewDate) {
      const daysSinceReview = daysBetween(lastReviewDate, new Date().toISOString());
      if (daysSinceReview > 90) flags.push('expired_assessment');
    }

    return {
      id: patientId,
      nhsNumber: get(row, 'nhsNumber'),
      name,
      facility,
      clinician,
      woundType,
      woundLocation,
      length,
      width,
      depth,
      surfaceArea,
      assessmentDate,
      lastReviewDate,
      diabetes,
      pad,
      pressureStage,
      infectionSigns,
      age,
      gender,
      missedReviews,
      daysActive,
      areaChangePct,
      healingTrend,
      dataQualityFlags: flags,
    };
  });
}

// ─── CSV Template ────────────────────────────────────────────────────────────
// Column headers only. One row per wound assessment, so a patient with several
// visits has several rows; healing trajectory is calculated from that history.

export function generateTemplateCSV(): string {
  return 'Patient_ID,NHS_Number,Patient_Name,Home_Name,Clinician,Wound_Type,Wound_Location,Wound_Area,Length,Width,Depth,Assessment_Date,Last_Review_Date,Diabetes,PAD,Pressure_Stage,Infection_Signs,Missed_Reviews,Age,Gender\n';
}
