/**
 * Family Tree Web App - Google Apps Script
 * Backend: Google Sheets
 * Required sheet: Persons
 */
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const PERSONS_SHEET = 'Persons';
const FAMILIES_SHEET = 'Families';
const FAMILY_CHILDREN_SHEET = 'FamilyChildren';

/* =========================
   APP ENTRY
   ========================= */

function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  const dbName = getDatabaseName();
  const stats = getDashboardStats_();

  template.dbName = dbName;
  template.pageTitle = 'Input Silsilah – ' + dbName;
  template.peopleCount = stats.peopleCount;
  template.lastUpdate = stats.lastUpdate;
  template.generationCount = stats.generationCount;

  return template.evaluate()
    .setTitle(template.pageTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =========================
   SPREADSHEET / SHEET HELPERS
   ========================= */

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('Set SPREADSHEET_ID di Code.gs terlebih dahulu.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getPersonsSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(PERSONS_SHEET);
  if (!sheet) throw new Error('Sheet "Persons" tidak ditemukan.');
  return sheet;
}

function getFamiliesSheetReadOnly_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(FAMILIES_SHEET);
}

function getFamilyChildrenSheetReadOnly_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(FAMILY_CHILDREN_SHEET);
}

function ensureFamiliesSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(FAMILIES_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(FAMILIES_SHEET);
    sheet.appendRow([
      'FamilyID',
      'Person1ID',
      'Person2ID',
      'RelationType',
      'StartYear',
      'EndYear',
      'IsActive',
      'Notes',
      'CreatedAt',
      'UpdatedAt',
      'CreatedBy',
      'UpdatedBy'
    ]);
  }

  return sheet;
}

function ensureFamilyChildrenSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(FAMILY_CHILDREN_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(FAMILY_CHILDREN_SHEET);
    sheet.appendRow([
      'LinkID',
      'FamilyID',
      'ChildID',
      'ChildOrder',
      'Notes',
      'CreatedAt',
      'UpdatedAt',
      'CreatedBy',
      'UpdatedBy'
    ]);
  }

  return sheet;
}

/* =========================
   META / DASHBOARD
   ========================= */

function getDatabaseName() {
  const ss = getSpreadsheet_();
  const meta = ss.getSheetByName('Meta');
  if (!meta) return 'Keluarga';
  return meta.getRange('B1').getValue() || 'Keluarga';
}

function getDashboardStats_() {
  const rows = getAllPeople_();
  return buildDashboardStatsFromRows_(rows);
}

function buildDashboardStatsFromRows_(rows) {
  const cleanRows = (rows || []).filter(r => r.PersonID && r.FullName);

  return {
    peopleCount: cleanRows.length,
    lastUpdate: getLastUpdateFromRows_(cleanRows),
    generationCount: getGenerationCountFromRows_(cleanRows)
  };
}

function getLastUpdateFromRows_(rows) {
  let last = null;

  (rows || []).forEach(r => {
    const updated = r.UpdatedAt || r.CreatedAt;
    if (!updated) return;

    const dt = new Date(updated);
    if (!last || dt > last) last = dt;
  });

  if (!last) return '-';

  return Utilities.formatDate(
    last,
    Session.getScriptTimeZone(),
    'dd MMM yyyy HH:mm'
  );
}

function getGenerationCountFromRows_(rows) {
  const byId = {};
  (rows || []).forEach(r => {
    if (r.PersonID) byId[r.PersonID] = r;
  });

  const memo = {};
  const visiting = {};

  function depthOf(personId) {
    if (!personId || !byId[personId]) return 0;
    if (memo[personId] !== undefined) return memo[personId];
    if (visiting[personId]) return 1;

    visiting[personId] = true;

    const p = byId[personId];
    const fatherDepth = p.FatherID ? depthOf(p.FatherID) : 0;
    const motherDepth = p.MotherID ? depthOf(p.MotherID) : 0;
    const depth = Math.max(fatherDepth, motherDepth) + 1;

    memo[personId] = depth;
    delete visiting[personId];
    return depth;
  }

  let maxDepth = 0;
  Object.keys(byId).forEach(id => {
    const d = depthOf(id);
    if (d > maxDepth) maxDepth = d;
  });

  return maxDepth;
}

/* =========================
   INDEX FOR UI
   ========================= */

function getPeopleIndex() {
  const rows = getAllPeople_();
  const relationshipCtx = buildRelationshipContext_();

  return rows
    .filter(r => r.PersonID && r.FullName)
    .map(r => {
      const families = relationshipCtx.familiesByPersonId[r.PersonID] || [];
      const activeFamilies = families.filter(f => normalizeBool_(f.IsActive));

      const uniqueSpouseIds = {};
      families.forEach(f => {
        const spouseId = f.Person1ID === r.PersonID ? f.Person2ID : f.Person1ID;
        if (spouseId) uniqueSpouseIds[spouseId] = true;
      });

      let relationshipType = 'none';
      if (families.length === 1) relationshipType = 'single';
      if (families.length > 1) relationshipType = 'multiple';
      if (families.length === 0 && r.SpouseID) relationshipType = 'single-legacy';

      return {
        id: r.PersonID,
        fullName: r.FullName,
        displayName: r.DisplayName || buildDisplayName_(r.FullName, r.BirthYear),
        gender: r.Gender || '',
        birthYear: r.BirthYear || '',
        spouseId: r.SpouseID || '',
        fatherId: r.FatherID || '',
        motherId: r.MotherID || '',
        hasFamilies: families.length > 0,

        familyCount: families.length,
        activeFamilyCount: activeFamilies.length,
        spouseCount: Object.keys(uniqueSpouseIds).length,
        relationshipType: relationshipType,

        activeSpouseIds: activeFamilies.map(f =>
          f.Person1ID === r.PersonID ? f.Person2ID : f.Person1ID
        )
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'id'));
}

/* =========================
   MAIN SUBMIT
   ========================= */

function submitFamily(payload) {
  validatePayload_(payload);

  if (isRecentDuplicateSubmit_('legacy', payload, 20)) {
    return {
      ok: false,
      recentDuplicateBlocked: true,
      message: 'Permintaan yang sama baru saja diproses. Cegah submit berulang.'
    };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const now = new Date();
    const userEmail = safeUserEmail_();
    const personCtx = buildDataContext_();
    const relationCtx = buildRelationshipWriteContext_();

    if (!payload.forceCreate) {
      const duplicateWarnings = collectDuplicateWarningsFromCtx_(personCtx, payload);
      if (duplicateWarnings.length) {
        return {
          ok: false,
          needsConfirm: true,
          duplicateWarnings: duplicateWarnings
        };
      }
    }

    let fatherId = payload.fatherMode === 'existing' ? (payload.fatherExistingId || '') : '';
    let motherId = payload.motherMode === 'existing' ? (payload.motherExistingId || '') : '';
    let selfId = '';
    let spouseId = '';

    validateParentGenderFromCtx_(fatherId, motherId, personCtx);

    if (payload.fatherMode === 'new' && payload.fatherNew && payload.fatherNew.fullName) {
      fatherId = createPersonWithCtx_(personCtx, normalizePersonInput_(payload.fatherNew, {
        gender: 'L',
        createdAt: now,
        createdBy: userEmail
      }));
    }

    if (payload.motherMode === 'new' && payload.motherNew && payload.motherNew.fullName) {
      motherId = createPersonWithCtx_(personCtx, normalizePersonInput_(payload.motherNew, {
        gender: 'P',
        createdAt: now,
        createdBy: userEmail
      }));
    }

    if (fatherId && motherId) {
      const fatherRow = personCtx.byId[fatherId];
      const motherRow = personCtx.byId[motherId];

      if (fatherRow && (!fatherRow.SpouseID || fatherRow.SpouseID === motherId)) {
        updatePersonFieldsWithCtx_(personCtx, fatherId, {
          IsMarried: true,
          SpouseID: motherId,
          UpdatedAt: now,
          UpdatedBy: userEmail
        });
      }

      if (motherRow && (!motherRow.SpouseID || motherRow.SpouseID === fatherId)) {
        updatePersonFieldsWithCtx_(personCtx, motherId, {
          IsMarried: true,
          SpouseID: fatherId,
          UpdatedAt: now,
          UpdatedBy: userEmail
        });
      }
    }

    if (payload.selfMode === 'existing') {
      selfId = payload.selfExistingId || '';
      if (!selfId) {
        throw new Error('Data diri existing belum dipilih.');
      }

      const selfRow = personCtx.byId[selfId];
      if (!selfRow) {
        throw new Error('Data diri existing tidak ditemukan.');
      }

      enforceParentRulesForExistingSelf_(selfRow, fatherId, motherId);

      const updates = {
        UpdatedAt: now,
        UpdatedBy: userEmail
      };

      if (!selfRow.FatherID && fatherId) updates.FatherID = fatherId;
      if (!selfRow.MotherID && motherId) updates.MotherID = motherId;

      if (Object.keys(updates).length > 2) {
        updatePersonFieldsWithCtx_(personCtx, selfId, updates);
      }
    } else {
      selfId = createPersonWithCtx_(personCtx, normalizePersonInput_(payload.self, {
        fatherId: fatherId,
        motherId: motherId,
        createdAt: now,
        createdBy: userEmail
      }));
    }

    let selfFamilyLinkResult = null;
    if (fatherId && motherId && selfId) {
      selfFamilyLinkResult = ensureFamilyAndLinkChildIfPossibleWithCtx_(
        relationCtx,
        fatherId,
        motherId,
        selfId,
        'Auto-link self dari submitFamily'
      );
    }

    if (payload.selfHasSpouse && payload.spouse && payload.spouse.fullName) {
      const selfRow = personCtx.byId[selfId];
      if (!selfRow) {
        throw new Error('Data diri tidak ditemukan saat memproses pasangan.');
      }

      if (selfRow.SpouseID) {
        spouseId = selfRow.SpouseID;
      } else {
        spouseId = createPersonWithCtx_(personCtx, normalizePersonInput_(payload.spouse, {
          createdAt: now,
          createdBy: userEmail,
          isMarried: true,
          spouseId: selfId
        }));

        updatePersonFieldsWithCtx_(personCtx, selfId, {
          IsMarried: true,
          SpouseID: spouseId,
          UpdatedAt: now,
          UpdatedBy: userEmail
        });
      }
    } else {
      const selfRow = personCtx.byId[selfId];
      spouseId = selfRow && selfRow.SpouseID ? selfRow.SpouseID : '';
    }

    const childIds = [];
    const selfGender = getSelfGenderFromCtx_(payload, selfId, personCtx);

    (payload.children || []).forEach(child => {
      if (!child || !child.fullName) return;

      const childInput = normalizePersonInput_(child, {
        createdAt: now,
        createdBy: userEmail
      });

      if (selfGender === 'L') {
        childInput.fatherId = selfId;
        childInput.motherId = spouseId || '';
      } else if (selfGender === 'P') {
        childInput.motherId = selfId;
        childInput.fatherId = spouseId || '';
      } else {
        childInput.fatherId = spouseId || '';
        childInput.motherId = '';
      }

      const newChildId = createPersonWithCtx_(personCtx, childInput);
      childIds.push(newChildId);

      if (childInput.fatherId && childInput.motherId) {
        ensureFamilyAndLinkChildIfPossibleWithCtx_(
          relationCtx,
          childInput.fatherId,
          childInput.motherId,
          newChildId,
          'Auto-link child dari submitFamily'
        );
      }
    });

    const stats = buildDashboardStatsFromRows_(personCtx.rows);

    return {
      ok: true,
      selfId: selfId,
      fatherId: fatherId || null,
      motherId: motherId || null,
      spouseId: spouseId || null,
      childIds: childIds,
      selfFamilyId: selfFamilyLinkResult && selfFamilyLinkResult.familyId ? selfFamilyLinkResult.familyId : null,
      peopleCount: stats.peopleCount,
      lastUpdate: stats.lastUpdate,
      generationCount: stats.generationCount
    };
  } finally {
    lock.releaseLock();
  }
}

/* =========================
   VALIDATION
   ========================= */

function validatePayload_(payload) {
  if (!payload) {
    throw new Error('Payload tidak valid.');
  }

  if (payload.selfMode === 'existing') {
    if (!payload.selfExistingId) {
      throw new Error('Pilih data diri yang sudah ada.');
    }
  } else {
    if (!payload.self || !payload.self.fullName) {
      throw new Error('Data diri wajib diisi.');
    }
  }

  ['self', 'fatherNew', 'motherNew', 'spouse'].forEach(k => {
    if (payload[k] && payload[k].birthYear && isNaN(Number(payload[k].birthYear))) {
      throw new Error('Tahun lahir/tahun wafat harus berupa angka.');
    }
    if (payload[k] && payload[k].deathYear && isNaN(Number(payload[k].deathYear))) {
      throw new Error('Tahun lahir/tahun wafat harus berupa angka.');
    }
    if (payload[k] && payload[k].isDeceased && !payload[k].deathYear) {
      throw new Error('Tahun wafat wajib diisi jika status sudah meninggal.');
    }
    if (
      payload[k] &&
      payload[k].birthYear &&
      payload[k].deathYear &&
      Number(payload[k].deathYear) < Number(payload[k].birthYear)
    ) {
      throw new Error('Tahun wafat tidak boleh lebih kecil dari tahun lahir.');
    }
  });

  (payload.children || []).forEach((child, idx) => {
    if (child.birthYear && isNaN(Number(child.birthYear))) {
      throw new Error('Tahun lahir anak #' + (idx + 1) + ' harus berupa angka.');
    }
    if (child.deathYear && isNaN(Number(child.deathYear))) {
      throw new Error('Tahun wafat anak #' + (idx + 1) + ' harus berupa angka.');
    }
    if (child.isDeceased && !child.deathYear) {
      throw new Error('Tahun wafat anak #' + (idx + 1) + ' wajib diisi jika status sudah meninggal.');
    }
    if (
      child.birthYear &&
      child.deathYear &&
      Number(child.deathYear) < Number(child.birthYear)
    ) {
      throw new Error('Tahun wafat anak #' + (idx + 1) + ' tidak boleh lebih kecil dari tahun lahir.');
    }
  });
}

function validateParentGenderFromCtx_(fatherId, motherId, ctx) {
  if (!fatherId && !motherId) return;

  if (fatherId) {
    const father = ctx.byId[fatherId];
    if (!father) {
      throw new Error('Data Ayah tidak ditemukan.');
    }
    if (father.Gender !== 'L') {
      throw new Error('Data yang dipilih sebagai Ayah harus berjenis kelamin L.');
    }
  }

  if (motherId) {
    const mother = ctx.byId[motherId];
    if (!mother) {
      throw new Error('Data Ibu tidak ditemukan.');
    }
    if (mother.Gender !== 'P') {
      throw new Error('Data yang dipilih sebagai Ibu harus berjenis kelamin P.');
    }
  }
}

function enforceParentRulesForExistingSelf_(selfRow, fatherId, motherId) {
  if (fatherId && selfRow.FatherID && selfRow.FatherID !== fatherId) {
    throw new Error('Data diri yang dipilih sudah memiliki Ayah lain. Parent tidak boleh dioverwrite.');
  }
  if (motherId && selfRow.MotherID && selfRow.MotherID !== motherId) {
    throw new Error('Data diri yang dipilih sudah memiliki Ibu lain. Parent tidak boleh dioverwrite.');
  }
}

function getSelfGenderFromCtx_(payload, selfId, ctx) {
  if (payload.selfMode === 'new') {
    return (payload.self && payload.self.gender) || '';
  }
  const selfRow = ctx.byId[selfId];
  return selfRow ? (selfRow.Gender || '') : '';
}

/* =========================
   GENERIC SHEET OBJECT READER
   ========================= */

function readSheetAsObjects_(sheet) {
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = values[0];
  const rows = values.length < 2
    ? []
    : values.slice(1).map((row, idx) => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        obj.__sheetRow = idx + 2;
        return obj;
      });

  return { headers: headers, rows: rows };
}

/* =========================
   DATA CONTEXT (PERSONS)
   ========================= */

function buildDataContext_() {
  const sheet = getPersonsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];

  const rows = values.length < 2
    ? []
    : values.slice(1).map((row, idx) => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        obj.__sheetRow = idx + 2;
        return obj;
      });

  const byId = {};
  let maxPersonCounter = 0;

  rows.forEach(r => {
    if (r.PersonID) {
      byId[r.PersonID] = r;
      const num = Number(String(r.PersonID).replace(/^P/, ''));
      if (!isNaN(num) && num > maxPersonCounter) {
        maxPersonCounter = num;
      }
    }
  });

  return {
    sheet: sheet,
    headers: headers,
    rows: rows,
    byId: byId,
    maxPersonCounter: maxPersonCounter
  };
}

function nextPersonIdFromCtx_(ctx) {
  if (!ctx) throw new Error('Context wajib diisi.');

  const props = PropertiesService.getScriptProperties();
  const key = 'LAST_PERSON_COUNTER';
  const stored = Number(props.getProperty(key) || '0');

  let n = Math.max(stored, ctx.maxPersonCounter || 0);
  n += 1;

  props.setProperty(key, String(n));
  ctx.maxPersonCounter = n;

  return 'P' + Utilities.formatString('%04d', n);
}

function createPersonWithCtx_(ctx, p) {
  const existingStrict = findExistingStrictPersonFromCtx_(ctx, p);
  if (existingStrict) {
    return existingStrict.PersonID;
  }
  const id = nextPersonIdFromCtx_(ctx);
  if (ctx.byId[id]) {
    throw new Error('Duplicate PersonID terdeteksi: ' + id + '. Counter perlu diperbaiki.');
  }

  const createdAt = p.createdAt || new Date();
  const createdBy = p.createdBy || '';
  const displayName = buildDisplayName_(p.fullName, p.birthYear);

  const rowObj = {
    PersonID: id,
    FullName: p.fullName,
    DisplayName: displayName,
    Gender: p.gender || '',
    BirthYear: p.birthYear || '',
    IsDeceased: p.isDeceased === true,
    DeathYear: p.deathYear || '',
    IsMarried: p.isMarried === true,
    FatherID: p.fatherId || '',
    MotherID: p.motherId || '',
    SpouseID: p.spouseId || '',
    CreatedAt: createdAt,
    UpdatedAt: createdAt,
    CreatedBy: createdBy,
    UpdatedBy: createdBy,
    Notes: p.notes || ''
  };

  const rowArray = headersToRowArray_(ctx.headers, rowObj);
  ctx.sheet.appendRow(rowArray);

  rowObj.__sheetRow = ctx.sheet.getLastRow();
  ctx.rows.push(rowObj);
  ctx.byId[id] = rowObj;

  return id;
}

function updatePersonFieldsWithCtx_(ctx, personId, updates) {
  const rowObj = ctx.byId[personId];
  if (!rowObj) throw new Error('Person tidak ditemukan: ' + personId);

  const sheetRow = rowObj.__sheetRow;
  if (!sheetRow) throw new Error('Sheet row tidak ditemukan untuk: ' + personId);

  Object.keys(updates).forEach(key => {
    const col = ctx.headers.indexOf(key);
    if (col >= 0) {
      const value = updates[key];
      ctx.sheet.getRange(sheetRow, col + 1).setValue(value);
      rowObj[key] = value;
    }
  });

  if (
    Object.prototype.hasOwnProperty.call(updates, 'FullName') ||
    Object.prototype.hasOwnProperty.call(updates, 'BirthYear')
  ) {
    const newDisplayName = buildDisplayName_(rowObj.FullName, rowObj.BirthYear);
    const displayCol = ctx.headers.indexOf('DisplayName');
    if (displayCol >= 0) {
      ctx.sheet.getRange(sheetRow, displayCol + 1).setValue(newDisplayName);
      rowObj.DisplayName = newDisplayName;
    }
  }
}

function headersToRowArray_(headers, rowObj) {
  return headers.map(h => rowObj[h] !== undefined ? rowObj[h] : '');
}

/* =========================
   PERSON CRUD (GENERIC / LEGACY SUPPORT)
   ========================= */

function normalizePersonInput_(src, extra) {
  const obj = Object.assign({}, extra || {});
  obj.fullName = String(src.fullName || '').trim();
  obj.gender = src.gender || obj.gender || '';
  obj.birthYear = toYearOrBlank_(src.birthYear);
  obj.isDeceased = normalizeBool_(src.isDeceased);
  obj.deathYear = toYearOrBlank_(src.deathYear);
  obj.isMarried = normalizeBool_(src.isMarried);
  obj.notes = src.notes || '';
  return obj;
}

function createPerson_(p) {
  const ctx = buildDataContext_();
  return createPersonWithCtx_(ctx, p);
}

function updatePersonFields_(personId, updates) {
  const ctx = buildDataContext_();
  updatePersonFieldsWithCtx_(ctx, personId, updates);
}

function getAllPeople_() {
  const sheet = getPersonsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}

/* =========================
   GENERIC HELPERS
   ========================= */

function buildDisplayName_(fullName, birthYear) {
  return fullName + (birthYear ? ' (' + birthYear + ')' : '');
}

function toYearOrBlank_(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value);
}

function normalizeBool_(value) {
  return value === true ||
    value === 'TRUE' ||
    value === 'true' ||
    value === 'Ya' ||
    value === 'YA' ||
    value === '1' ||
    value === 1;
}

function safeUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

/* =========================
   BACKUP / DUPLICATE / SAFE SUBMIT HELPERS
   ========================= */

const DUPLICATE_REVIEW_SHEET = 'DuplicateReview';
const MERGE_LOG_SHEET = 'MergeLog';

function backupAllFamilySheets() {
  const ss = getSpreadsheet_();
  const tz = Session.getScriptTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');

  [PERSONS_SHEET, FAMILIES_SHEET, FAMILY_CHILDREN_SHEET].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.copyTo(ss).setName(name + '_backup_' + stamp);
  });

  return {
    ok: true,
    stamp: stamp
  };
}

function normalizeLooseText_(v) {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function buildStrictPersonKey_(p) {
  return [
    normalizeLooseText_(p.FullName),
    normalizeLooseText_(p.Gender),
    normalizeLooseText_(p.BirthYear),
    normalizeLooseText_(p.FatherID),
    normalizeLooseText_(p.MotherID)
  ].join('|');
}

function buildLoosePersonKey_(p) {
  return [
    normalizeLooseText_(p.FullName),
    normalizeLooseText_(p.Gender),
    normalizeLooseText_(p.BirthYear)
  ].join('|');
}

function getDuplicateReviewDecisionMap_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(DUPLICATE_REVIEW_SHEET);
  if (!sh) return {};

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return {};

  const headers = values[0];
  const idxGroupKey = headers.indexOf('GroupKey');
  const idxDupType = headers.indexOf('DuplicateType');
  const idxCandidate = headers.indexOf('CandidatePersonID');
  const idxDecision = headers.indexOf('Decision');

  if (idxGroupKey < 0 || idxDupType < 0 || idxCandidate < 0 || idxDecision < 0) {
    return {};
  }

  const map = {};

  values.slice(1).forEach(row => {
    const groupKey = String(row[idxGroupKey] || '').trim();
    const dupType = String(row[idxDupType] || '').trim();
    const candidateId = String(row[idxCandidate] || '').trim();
    const decision = String(row[idxDecision] || '').trim().toUpperCase();

    if (!groupKey || !dupType || !candidateId || !decision) return;

    const key = dupType + '|' + groupKey + '|' + candidateId;
    map[key] = decision;
  });

  return map;
}
function getDuplicateReviewManualMap_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(DUPLICATE_REVIEW_SHEET);
  if (!sh) return {};

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return {};

  const headers = values[0];
  const idxGroupKey = headers.indexOf('GroupKey');
  const idxDupType = headers.indexOf('DuplicateType');
  const idxCandidate = headers.indexOf('CandidatePersonID');
  const idxDecision = headers.indexOf('Decision');
  const idxManualNote = headers.indexOf('ManualNote');

  if (idxGroupKey < 0 || idxDupType < 0 || idxCandidate < 0) {
    return {};
  }

  const map = {};

  values.slice(1).forEach(row => {
    const groupKey = String(row[idxGroupKey] || '').trim();
    const dupType = String(row[idxDupType] || '').trim();
    const candidateId = String(row[idxCandidate] || '').trim();

    if (!groupKey || !dupType || !candidateId) return;

    const key = dupType + '|' + groupKey + '|' + candidateId;
    map[key] = {
      decision: idxDecision >= 0 ? String(row[idxDecision] || '') : '',
      manualNote: idxManualNote >= 0 ? String(row[idxManualNote] || '') : ''
    };
  });

  return map;
}
function parseDateMsSafe_(v, fallbackMs) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return fallbackMs || 0;
  return d.getTime();
}

function countFamilyRefsForPerson_(personId, families) {
  return (families || []).filter(f =>
    String(f.Person1ID || '') === String(personId || '') ||
    String(f.Person2ID || '') === String(personId || '')
  ).length;
}

function countChildRefsForPerson_(personId, familyChildren) {
  return (familyChildren || []).filter(c =>
    String(c.ChildID || '') === String(personId || '')
  ).length;
}

function calcPersonMergeScore_(p, families, familyChildren) {
  let score = 0;

  if (p.FullName) score += 2;
  if (p.DisplayName) score += 1;
  if (p.Gender) score += 1;
  if (p.BirthYear) score += 1;
  if (p.IsDeceased !== '') score += 1;
  if (p.DeathYear) score += 1;
  if (p.IsMarried !== '') score += 1;
  if (p.FatherID) score += 1;
  if (p.MotherID) score += 1;
  if (p.SpouseID) score += 3;
  if (p.Notes) score += 1;

  score += countFamilyRefsForPerson_(p.PersonID, families) * 2;
  score += countChildRefsForPerson_(p.PersonID, familyChildren) * 2;

  return score;
}

function chooseKeeperPerson_(rows, families, familyChildren) {
  const scored = (rows || []).map(r => ({
    row: r,
    score: calcPersonMergeScore_(r, families, familyChildren),
    createdAtMs: parseDateMsSafe_(r.CreatedAt, 9999999999999)
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.createdAtMs - b.createdAtMs;
  });

  return scored.length ? scored[0].row : null;
}

function mergeTwoPersonRows_(base, extra) {
  const out = Object.assign({}, base);

  const fillIfBlankFields = [
    'FullName',
    'DisplayName',
    'Gender',
    'BirthYear',
    'IsDeceased',
    'DeathYear',
    'IsMarried',
    'FatherID',
    'MotherID',
    'SpouseID',
    'CreatedBy',
    'UpdatedBy'
  ];

  fillIfBlankFields.forEach(f => {
    const a = String(out[f] || '').trim();
    const b = String(extra[f] || '').trim();
    if (!a && b) out[f] = extra[f];
  });

  const createdBase = parseDateMsSafe_(out.CreatedAt, 9999999999999);
  const createdExtra = parseDateMsSafe_(extra.CreatedAt, 9999999999999);
  if ((!out.CreatedAt && extra.CreatedAt) || createdExtra < createdBase) {
    out.CreatedAt = extra.CreatedAt;
  }

  const updatedBase = parseDateMsSafe_(out.UpdatedAt, 0);
  const updatedExtra = parseDateMsSafe_(extra.UpdatedAt, 0);
  if ((!out.UpdatedAt && extra.UpdatedAt) || updatedExtra > updatedBase) {
    out.UpdatedAt = extra.UpdatedAt;
    if (extra.UpdatedBy) out.UpdatedBy = extra.UpdatedBy;
  }

  const notesA = String(out.Notes || '').trim();
  const notesB = String(extra.Notes || '').trim();
  if (!notesA && notesB) {
    out.Notes = notesB;
  } else if (notesA && notesB && notesA !== notesB) {
    out.Notes = notesA + ' | ' + notesB;
  }

  return out;
}

function remapIdChain_(id, idMap) {
  let current = String(id || '').trim();
  if (!current) return '';

  const seen = {};
  while (idMap[current] && !seen[current]) {
    seen[current] = true;
    current = idMap[current];
  }
  return current;
}

function getSheetObjectsWithHeaders_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values || !values.length) {
    return { headers: [], rows: [] };
  }

  const headers = values[0];
  const rows = values.length < 2 ? [] : values.slice(1).map((row, idx) => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    obj.__sheetRow = idx + 2;
    return obj;
  });

  return { headers: headers, rows: rows };
}

function rewriteWholeSheetFromObjects_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!rows || !rows.length) return;

  const values = rows.map(r => headers.map(h => r[h] !== undefined ? r[h] : ''));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function appendRowsWithHeaderIfNeeded_(sheet, headers, rows) {
  if (!rows || !rows.length) return;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function ensureDuplicateReviewSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(DUPLICATE_REVIEW_SHEET);

  if (!sh) sh = ss.insertSheet(DUPLICATE_REVIEW_SHEET);

  return sh;
}

function ensureMergeLogSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(MERGE_LOG_SHEET);

  if (!sh) sh = ss.insertSheet(MERGE_LOG_SHEET);

  return sh;
}

function buildSubmitFingerprint_(payload) {
  const raw = JSON.stringify(payload || {});
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    raw,
    Utilities.Charset.UTF_8
  );

  return digest.map(b => {
    const n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function isRecentDuplicateSubmit_(scope, payload, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const key = 'FAMILY_SUBMIT_' + String(scope || 'legacy') + '_' + buildSubmitFingerprint_(payload);
  const existing = cache.get(key);

  if (existing) return true;

  cache.put(key, '1', ttlSeconds || 20);
  return false;
}

function findExistingStrictPersonFromCtx_(ctx, personInput) {
  if (!ctx || !ctx.rows || !personInput) return null;

  const target = {
    FullName: personInput.fullName || '',
    Gender: personInput.gender || '',
    BirthYear: toYearOrBlank_(personInput.birthYear),
    FatherID: personInput.fatherId || '',
    MotherID: personInput.motherId || ''
  };

  const targetKey = buildStrictPersonKey_(target);

  return ctx.rows.find(r => buildStrictPersonKey_(r) === targetKey) || null;
}

function findDuplicateCandidates() {
  const personsSheet = getPersonsSheet_();
  const familiesSheet = getFamiliesSheetReadOnly_();
  const familyChildrenSheet = getFamilyChildrenSheetReadOnly_();

  const personsData = getSheetObjectsWithHeaders_(personsSheet);
  const familiesData = getSheetObjectsWithHeaders_(familiesSheet);
  const familyChildrenData = getSheetObjectsWithHeaders_(familyChildrenSheet);
  const manualMap = getDuplicateReviewManualMap_();
  const persons = personsData.rows || [];
  const families = familiesData.rows || [];
  const familyChildren = familyChildrenData.rows || [];

  const strictGroups = {};
  const looseGroups = {};

  persons.forEach(p => {
    const strictKey = buildStrictPersonKey_(p);
    const looseKey = buildLoosePersonKey_(p);

    if (strictKey && normalizeLooseText_(p.FullName)) {
      if (!strictGroups[strictKey]) strictGroups[strictKey] = [];
      strictGroups[strictKey].push(p);
    }

    if (looseKey && normalizeLooseText_(p.FullName)) {
      if (!looseGroups[looseKey]) looseGroups[looseKey] = [];
      looseGroups[looseKey].push(p);
    }
  });

  const rows = [];

  Object.keys(strictGroups).forEach(key => {
    const group = strictGroups[key];
    if (group.length < 2) return;

    const keeper = chooseKeeperPerson_(group, families, familyChildren);

    group.forEach(p => {
      const manualKey = 'STRICT|' + key + '|' + String(p.PersonID || '');
      const manual = manualMap[manualKey] || { decision: '', manualNote: '' };

      rows.push([
        key,
        'STRICT',
        keeper ? keeper.PersonID : '',
        p.PersonID || '',
        p.FullName || '',
        p.Gender || '',
        p.BirthYear || '',
        p.FatherID || '',
        p.MotherID || '',
        p.SpouseID || '',
        countFamilyRefsForPerson_(p.PersonID, families),
        countChildRefsForPerson_(p.PersonID, familyChildren),
        calcPersonMergeScore_(p, families, familyChildren),
        p.CreatedAt || '',
        p.UpdatedAt || '',
        keeper && p.PersonID === keeper.PersonID ? 'KEEP' : 'REVIEW_STRICT',
        p.Notes || '',
        manual.decision || '',
        manual.manualNote || ''
      ]);
    });
  });

  Object.keys(looseGroups).forEach(key => {
    const group = looseGroups[key];
    if (group.length < 2) return;

    const strictKeys = {};
    group.forEach(p => {
      strictKeys[buildStrictPersonKey_(p)] = true;
    });

    if (Object.keys(strictKeys).length === 1) return;

    const keeper = chooseKeeperPerson_(group, families, familyChildren);

    group.forEach(p => {
      const manualKey = 'LOOSE|' + key + '|' + String(p.PersonID || '');
      const manual = manualMap[manualKey] || { decision: '', manualNote: '' };

      rows.push([
        key,
        'LOOSE',
        keeper ? keeper.PersonID : '',
        p.PersonID || '',
        p.FullName || '',
        p.Gender || '',
        p.BirthYear || '',
        p.FatherID || '',
        p.MotherID || '',
        p.SpouseID || '',
        countFamilyRefsForPerson_(p.PersonID, families),
        countChildRefsForPerson_(p.PersonID, familyChildren),
        calcPersonMergeScore_(p, families, familyChildren),
        p.CreatedAt || '',
        p.UpdatedAt || '',
        keeper && p.PersonID === keeper.PersonID ? 'REVIEW_KEEP' : 'REVIEW_ONLY',
        p.Notes || '',
        manual.decision || '',
        manual.manualNote || ''
      ]);
    });
  });

  const reviewSheet = ensureDuplicateReviewSheet_();
  const headers = [
    'GroupKey',
    'DuplicateType',
    'KeepPersonID',
    'CandidatePersonID',
    'FullName',
    'Gender',
    'BirthYear',
    'FatherID',
    'MotherID',
    'SpouseID',
    'FamilyRefCount',
    'ChildRefCount',
    'CompletenessScore',
    'CreatedAt',
    'UpdatedAt',
    'ActionSuggestion',
    'Notes',
    'Decision',
    'ManualNote'
  ];

  rewriteWholeSheetFromObjects_(
    reviewSheet,
    headers,
    rows.map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i]);
      return o;
    })
  );

  return {
    ok: true,
    reviewRows: rows.length
  };
}

function mergeDuplicatePersonsSafe() {
  const ss = getSpreadsheet_();

  const personsSheet = getPersonsSheet_();
  const familiesSheet = getFamiliesSheetReadOnly_();
  const familyChildrenSheet = getFamilyChildrenSheetReadOnly_();
  const decisionMap = getDuplicateReviewDecisionMap_();

  if (!familiesSheet || !familyChildrenSheet) {
    throw new Error('Families / FamilyChildren sheet belum tersedia.');
  }

  const personsData = getSheetObjectsWithHeaders_(personsSheet);
  const familiesData = getSheetObjectsWithHeaders_(familiesSheet);
  const familyChildrenData = getSheetObjectsWithHeaders_(familyChildrenSheet);

  const personHeaders = personsData.headers;
  const familyHeaders = familiesData.headers;
  const childHeaders = familyChildrenData.headers;

  const persons = personsData.rows || [];
  const families = familiesData.rows || [];
  const familyChildren = familyChildrenData.rows || [];

  const strictGroups = {};
  persons.forEach(p => {
    const key = buildStrictPersonKey_(p);
    if (!normalizeLooseText_(p.FullName)) return;
    if (!strictGroups[key]) strictGroups[key] = [];
    strictGroups[key].push(p);
  });

  const personIdMap = {};
  const mergeLogRows = [];

  Object.keys(strictGroups).forEach(key => {
    const group = strictGroups[key];
    if (group.length < 2) return;

    const keeper = chooseKeeperPerson_(group, families, familyChildren);
    if (!keeper) return;

    group.forEach(p => {
      if (p.PersonID === keeper.PersonID) return;

      const reviewKey = 'STRICT|' + key + '|' + p.PersonID;
      const decision = decisionMap[reviewKey] || '';

      if (decision !== 'MERGE') {
        return;
      }

      personIdMap[p.PersonID] = keeper.PersonID;
      mergeLogRows.push([
        new Date(),
        'APPROVED_MERGE_STRICT',
        p.PersonID,
        keeper.PersonID,
        p.FullName || '',
        key
      ]);
    });
  });

  if (!Object.keys(personIdMap).length) {
    return {
      ok: true,
      mergedCount: 0
    };
  }

  persons.forEach(p => {
    p.FatherID = remapIdChain_(p.FatherID, personIdMap);
    p.MotherID = remapIdChain_(p.MotherID, personIdMap);
    p.SpouseID = remapIdChain_(p.SpouseID, personIdMap);
  });

  const mergedPersonsById = {};
  persons.forEach(p => {
    const finalId = remapIdChain_(p.PersonID, personIdMap);

    if (!mergedPersonsById[finalId]) {
      mergedPersonsById[finalId] = Object.assign({}, p, { PersonID: finalId });
    } else {
      mergedPersonsById[finalId] = mergeTwoPersonRows_(mergedPersonsById[finalId], p);
      mergedPersonsById[finalId].PersonID = finalId;
    }
  });

  const personsClean = Object.keys(mergedPersonsById).map(id => {
    const row = mergedPersonsById[id];
    if (String(row.PersonID || '') === String(row.FatherID || '')) row.FatherID = '';
    if (String(row.PersonID || '') === String(row.MotherID || '')) row.MotherID = '';
    if (String(row.PersonID || '') === String(row.SpouseID || '')) row.SpouseID = '';
    delete row.__sheetRow;
    return row;
  });

  families.forEach(f => {
    f.Person1ID = remapIdChain_(f.Person1ID, personIdMap);
    f.Person2ID = remapIdChain_(f.Person2ID, personIdMap);
  });

  const familyIdMap = {};
  const dedupedFamilies = [];
  const familySeen = {};

  families.forEach(f => {
    const key = [
      canonicalPairKey_(f.Person1ID, f.Person2ID),
      String(f.RelationType || '').trim(),
      String(f.StartYear || '').trim(),
      String(f.EndYear || '').trim()
    ].join('|');

    if (!familySeen[key]) {
      familySeen[key] = Object.assign({}, f);
      dedupedFamilies.push(familySeen[key]);
      familyIdMap[f.FamilyID] = f.FamilyID;
    } else {
      const keep = familySeen[key];
      familyIdMap[f.FamilyID] = keep.FamilyID;

      if (!keep.Notes && f.Notes) keep.Notes = f.Notes;
      if (!keep.CreatedAt || parseDateMsSafe_(f.CreatedAt, 9999999999999) < parseDateMsSafe_(keep.CreatedAt, 9999999999999)) {
        keep.CreatedAt = f.CreatedAt || keep.CreatedAt;
      }
      if (!keep.UpdatedAt || parseDateMsSafe_(f.UpdatedAt, 0) > parseDateMsSafe_(keep.UpdatedAt, 0)) {
        keep.UpdatedAt = f.UpdatedAt || keep.UpdatedAt;
      }
      if (normalizeBool_(f.IsActive)) keep.IsActive = true;
    }
  });

  const familyChildrenSeen = {};
  const dedupedChildren = [];

  familyChildren.forEach(c => {
    c.ChildID = remapIdChain_(c.ChildID, personIdMap);
    c.FamilyID = familyIdMap[c.FamilyID] || c.FamilyID;

    const key = String(c.FamilyID || '') + '::' + String(c.ChildID || '');
    if (!c.FamilyID || !c.ChildID) return;
    if (familyChildrenSeen[key]) return;

    familyChildrenSeen[key] = Object.assign({}, c);
    dedupedChildren.push(familyChildrenSeen[key]);
  });

  const groupedByFamily = {};
  dedupedChildren.forEach(c => {
    if (!groupedByFamily[c.FamilyID]) groupedByFamily[c.FamilyID] = [];
    groupedByFamily[c.FamilyID].push(c);
  });

  const finalChildren = [];
  Object.keys(groupedByFamily).forEach(familyId => {
    const arr = groupedByFamily[familyId].slice().sort((a, b) => {
      const ao = Number(a.ChildOrder || 9999);
      const bo = Number(b.ChildOrder || 9999);
      if (ao !== bo) return ao - bo;
      return parseDateMsSafe_(a.CreatedAt, 9999999999999) - parseDateMsSafe_(b.CreatedAt, 9999999999999);
    });

    arr.forEach((c, idx) => {
      c.ChildOrder = idx + 1;
      delete c.__sheetRow;
      finalChildren.push(c);
    });
  });

  dedupedFamilies.forEach(r => delete r.__sheetRow);

  rewriteWholeSheetFromObjects_(personsSheet, personHeaders, personsClean);
  rewriteWholeSheetFromObjects_(familiesSheet, familyHeaders, dedupedFamilies);
  rewriteWholeSheetFromObjects_(familyChildrenSheet, childHeaders, finalChildren);

  const mergeLogSheet = ensureMergeLogSheet_();
  appendRowsWithHeaderIfNeeded_(
    mergeLogSheet,
    ['Timestamp', 'Action', 'OldPersonID', 'KeepPersonID', 'FullName', 'Reason'],
    mergeLogRows
  );

  repairPersonCounter_();

  return {
    ok: true,
    mergedCount: Object.keys(personIdMap).length
  };
}

/* =========================
   DUPLICATE DETECTION
   ========================= */

function normalizeNameForCompare_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDuplicateCandidatesFromRows_(rows, personInput, roleLabel) {
  const fullName = String((personInput && personInput.fullName) || '').trim();
  const gender = String((personInput && personInput.gender) || '').trim();
  const birthYear = personInput && personInput.birthYear ? Number(personInput.birthYear) : '';

  if (!fullName || !gender) return [];

  const normalizedInputName = normalizeNameForCompare_(fullName);

  const scored = (rows || []).map(p => {
    const existingName = String(p.FullName || '').trim();
    const existingGender = String(p.Gender || '').trim();
    const existingBirthYear = p.BirthYear ? Number(p.BirthYear) : '';

    if (!existingName) return null;
    if (existingGender !== gender) return null;

    const normalizedExistingName = normalizeNameForCompare_(existingName);

    let score = 0;
    let nameMatchType = '';

    if (normalizedExistingName === normalizedInputName) {
      score += 80;
      nameMatchType = 'exact';
    } else if (
      normalizedExistingName.includes(normalizedInputName) ||
      normalizedInputName.includes(normalizedExistingName)
    ) {
      score += 55;
      nameMatchType = 'partial';
    } else {
      return null;
    }

    let birthYearHint = '';

    if (birthYear && existingBirthYear) {
      const diff = Math.abs(birthYear - existingBirthYear);

      if (diff === 0) {
        score += 20;
        birthYearHint = 'same';
      } else if (diff <= 2) {
        score += 12;
        birthYearHint = 'near';
      } else if (diff <= 5) {
        score += 6;
        birthYearHint = 'close';
      } else {
        birthYearHint = 'far';
      }
    } else if (!birthYear || !existingBirthYear) {
      birthYearHint = 'unknown';
    }

    return {
      id: p.PersonID,
      fullName: p.FullName || '',
      displayName: p.DisplayName || buildDisplayName_(p.FullName, p.BirthYear),
      gender: p.Gender || '',
      birthYear: p.BirthYear || '',
      role: roleLabel || '',
      score: score,
      nameMatchType: nameMatchType,
      birthYearHint: birthYearHint
    };
  })
  .filter(Boolean)
  .filter(x => x.score >= 55)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

  return scored;
}

function collectDuplicateWarningsFromCtx_(ctx, payload) {
  const warnings = [];
  const rows = ctx && ctx.rows ? ctx.rows : [];

  if (payload.fatherMode === 'new' && payload.fatherNew && payload.fatherNew.fullName) {
    const candidates = findDuplicateCandidatesFromRows_(
      rows,
      Object.assign({}, payload.fatherNew, { gender: 'L' }),
      'Ayah'
    );
    if (candidates.length) {
      warnings.push({
        role: 'Ayah',
        inputName: payload.fatherNew.fullName || '',
        inputBirthYear: payload.fatherNew.birthYear || '',
        candidates: candidates
      });
    }
  }

  if (payload.motherMode === 'new' && payload.motherNew && payload.motherNew.fullName) {
    const candidates = findDuplicateCandidatesFromRows_(
      rows,
      Object.assign({}, payload.motherNew, { gender: 'P' }),
      'Ibu'
    );
    if (candidates.length) {
      warnings.push({
        role: 'Ibu',
        inputName: payload.motherNew.fullName || '',
        inputBirthYear: payload.motherNew.birthYear || '',
        candidates: candidates
      });
    }
  }

  if (payload.selfMode === 'new' && payload.self && payload.self.fullName) {
    const candidates = findDuplicateCandidatesFromRows_(rows, payload.self, 'Data Diri');
    if (candidates.length) {
      warnings.push({
        role: 'Data Diri',
        inputName: payload.self.fullName || '',
        inputBirthYear: payload.self.birthYear || '',
        candidates: candidates
      });
    }
  }

  return warnings;
}

function collectDuplicateWarnings_(payload) {
  const ctx = buildDataContext_();
  return collectDuplicateWarningsFromCtx_(ctx, payload);
}

/* =========================
   RESET DATA
   ========================= */

function resetFamilyData() {
  const email = safeUserEmail_();
  const allowed = ['youremail@email.com'];

  if (!allowed.includes(email)) {
    throw new Error('Anda tidak punya izin untuk reset data.');
  }

  const personsSheet = getPersonsSheet_();
  const personData = personsSheet.getDataRange().getValues();

  if (personData.length > 1) {
    personsSheet.getRange(2, 1, personData.length - 1, personData[0].length).clearContent();
  }

  const familiesSheet = getFamiliesSheetReadOnly_();
  if (familiesSheet) {
    const values = familiesSheet.getDataRange().getValues();
    if (values.length > 1) {
      familiesSheet.getRange(2, 1, values.length - 1, values[0].length).clearContent();
    }
  }

  const familyChildrenSheet = getFamilyChildrenSheetReadOnly_();
  if (familyChildrenSheet) {
    const values = familyChildrenSheet.getDataRange().getValues();
    if (values.length > 1) {
      familyChildrenSheet.getRange(2, 1, values.length - 1, values[0].length).clearContent();
    }
  }

  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LAST_PERSON_COUNTER');
  props.deleteProperty('LAST_FAMILY_COUNTER');
  props.deleteProperty('LAST_CHILD_LINK_COUNTER');

  return {
    ok: true,
    peopleCount: 0,
    lastUpdate: '-',
    generationCount: 0
  };
}

/* =========================
   RELATIONSHIP CONTEXT V2
   READ-ONLY: tidak create sheet
   ========================= */

function buildRelationshipContext_() {
  const personsSheet = getPersonsSheet_();
  const familiesSheet = getFamiliesSheetReadOnly_();
  const familyChildrenSheet = getFamilyChildrenSheetReadOnly_();

  const personsData = readSheetAsObjects_(personsSheet);
  const familiesData = readSheetAsObjects_(familiesSheet);
  const familyChildrenData = readSheetAsObjects_(familyChildrenSheet);

  return buildRelationshipIndexes_({
    personsSheet: personsSheet,
    familiesSheet: familiesSheet,
    familyChildrenSheet: familyChildrenSheet,
    personsData: personsData,
    familiesData: familiesData,
    familyChildrenData: familyChildrenData
  });
}

/* =========================
   RELATIONSHIP WRITE CONTEXT V2
   WRITE PATH: create sheet jika belum ada
   ========================= */

function buildRelationshipWriteContext_() {
  const personsSheet = getPersonsSheet_();
  const familiesSheet = ensureFamiliesSheet_();
  const familyChildrenSheet = ensureFamilyChildrenSheet_();

  const personsData = readSheetAsObjects_(personsSheet);
  const familiesData = readSheetAsObjects_(familiesSheet);
  const familyChildrenData = readSheetAsObjects_(familyChildrenSheet);

  return buildRelationshipIndexes_({
    personsSheet: personsSheet,
    familiesSheet: familiesSheet,
    familyChildrenSheet: familyChildrenSheet,
    personsData: personsData,
    familiesData: familiesData,
    familyChildrenData: familyChildrenData
  });
}

function buildRelationshipIndexes_(input) {
  const personsData = input.personsData || { headers: [], rows: [] };
  const familiesData = input.familiesData || { headers: [], rows: [] };
  const familyChildrenData = input.familyChildrenData || { headers: [], rows: [] };

  const personById = {};
  const familyById = {};
  const familiesByPersonId = {};
  const childrenByFamilyId = {};
  const familyLinksByChildId = {};
  const familyByPairKey = {};
  const familyChildByPairKey = {};

  let maxFamilyCounter = 0;
  let maxChildLinkCounter = 0;

  personsData.rows.forEach(p => {
    if (p.PersonID) personById[p.PersonID] = p;
  });

  familiesData.rows.forEach(f => {
    if (!f.FamilyID) return;

    familyById[f.FamilyID] = f;

    const pairKey = canonicalPairKey_(f.Person1ID, f.Person2ID);
    if (pairKey && !familyByPairKey[pairKey]) {
      familyByPairKey[pairKey] = f;
    }

    if (f.Person1ID) {
      if (!familiesByPersonId[f.Person1ID]) familiesByPersonId[f.Person1ID] = [];
      familiesByPersonId[f.Person1ID].push(f);
    }

    if (f.Person2ID) {
      if (!familiesByPersonId[f.Person2ID]) familiesByPersonId[f.Person2ID] = [];
      familiesByPersonId[f.Person2ID].push(f);
    }

    const num = Number(String(f.FamilyID).replace(/^F/, ''));
    if (!isNaN(num) && num > maxFamilyCounter) {
      maxFamilyCounter = num;
    }
  });

  familyChildrenData.rows.forEach(link => {
    if (!link.FamilyID) return;

    if (!childrenByFamilyId[link.FamilyID]) childrenByFamilyId[link.FamilyID] = [];
    childrenByFamilyId[link.FamilyID].push(link);

    const pairKey = String(link.FamilyID || '') + '::' + String(link.ChildID || '');
    if (link.FamilyID && link.ChildID && !familyChildByPairKey[pairKey]) {
      familyChildByPairKey[pairKey] = link;
    }

    if (link.ChildID) {
      if (!familyLinksByChildId[link.ChildID]) familyLinksByChildId[link.ChildID] = [];
      familyLinksByChildId[link.ChildID].push(link);
    }

    const num = Number(String(link.LinkID || '').replace(/^C/, ''));
    if (!isNaN(num) && num > maxChildLinkCounter) {
      maxChildLinkCounter = num;
    }
  });

  return {
    personsSheet: input.personsSheet || null,
    familiesSheet: input.familiesSheet || null,
    familyChildrenSheet: input.familyChildrenSheet || null,

    personHeaders: personsData.headers,
    familyHeaders: familiesData.headers,
    familyChildHeaders: familyChildrenData.headers,

    persons: personsData.rows,
    families: familiesData.rows,
    familyChildren: familyChildrenData.rows,

    personById: personById,
    familyById: familyById,
    familiesByPersonId: familiesByPersonId,
    childrenByFamilyId: childrenByFamilyId,
    familyLinksByChildId: familyLinksByChildId,
    familyByPairKey: familyByPairKey,
    familyChildByPairKey: familyChildByPairKey,

    maxFamilyCounter: maxFamilyCounter,
    maxChildLinkCounter: maxChildLinkCounter
  };
}

/* =========================
   ID GENERATORS V2
   ========================= */

function nextFamilyIdFromCtx_(ctx) {
  if (!ctx) throw new Error('Relationship context wajib diisi.');

  const props = PropertiesService.getScriptProperties();
  const key = 'LAST_FAMILY_COUNTER';
  const stored = Number(props.getProperty(key) || '0');

  let n = Math.max(stored, ctx.maxFamilyCounter || 0);
  n += 1;

  props.setProperty(key, String(n));
  ctx.maxFamilyCounter = n;

  return 'F' + Utilities.formatString('%04d', n);
}

function nextChildLinkIdFromCtx_(ctx) {
  if (!ctx) throw new Error('Relationship context wajib diisi.');

  const props = PropertiesService.getScriptProperties();
  const key = 'LAST_CHILD_LINK_COUNTER';
  const stored = Number(props.getProperty(key) || '0');

  let n = Math.max(stored, ctx.maxChildLinkCounter || 0);
  n += 1;

  props.setProperty(key, String(n));
  ctx.maxChildLinkCounter = n;

  return 'C' + Utilities.formatString('%04d', n);
}

/* =========================
   RAW READERS V2
   ========================= */

function getAllFamilies_() {
  return buildRelationshipContext_().families;
}

function getAllFamilyChildren_() {
  return buildRelationshipContext_().familyChildren;
}

/* =========================
   FAMILY CRUD V2
   ========================= */

function normalizeFamilyInput_(src, extra) {
  const obj = Object.assign({}, extra || {});

  obj.person1Id = String(src.person1Id || obj.person1Id || '').trim();
  obj.person2Id = String(src.person2Id || obj.person2Id || '').trim();
  obj.relationType = String(src.relationType || obj.relationType || 'Marriage').trim();
  obj.startYear = toYearOrBlank_(src.startYear !== undefined ? src.startYear : obj.startYear);
  obj.endYear = toYearOrBlank_(src.endYear !== undefined ? src.endYear : obj.endYear);
  obj.isActive = src.isActive !== undefined ? normalizeBool_(src.isActive) : normalizeBool_(obj.isActive);
  obj.notes = src.notes !== undefined ? String(src.notes || '') : String(obj.notes || '');

  return obj;
}

function canonicalPairKey_(personAId, personBId) {
  const a = String(personAId || '').trim();
  const b = String(personBId || '').trim();
  if (!a || !b) return '';
  return [a, b].sort().join('::');
}

function findFamilyByCoupleFromCtx_(ctx, personAId, personBId) {
  const targetKey = canonicalPairKey_(personAId, personBId);
  if (!targetKey) return null;
  return (ctx && ctx.familyByPairKey && ctx.familyByPairKey[targetKey]) || null;
}

function findFamilyByCouple_(personAId, personBId) {
  const ctx = buildRelationshipContext_();
  return findFamilyByCoupleFromCtx_(ctx, personAId, personBId);
}

function createFamilyWithCtx_(ctx, familyInput) {
  if (!ctx || !ctx.familiesSheet) {
    throw new Error('Relationship write context tidak valid.');
  }

  const now = familyInput.createdAt || new Date();
  const userEmail = familyInput.createdBy || '';
  const familyId = nextFamilyIdFromCtx_(ctx);

  const rowObj = {
    FamilyID: familyId,
    Person1ID: familyInput.person1Id || '',
    Person2ID: familyInput.person2Id || '',
    RelationType: familyInput.relationType || 'Marriage',
    StartYear: familyInput.startYear || '',
    EndYear: familyInput.endYear || '',
    IsActive: familyInput.isActive === true,
    Notes: familyInput.notes || '',
    CreatedAt: now,
    UpdatedAt: now,
    CreatedBy: userEmail,
    UpdatedBy: userEmail
  };

  const rowArray = headersToRowArray_(ctx.familyHeaders, rowObj);
  ctx.familiesSheet.appendRow(rowArray);

  rowObj.__sheetRow = ctx.familiesSheet.getLastRow();
  ctx.families.push(rowObj);
  ctx.familyById[familyId] = rowObj;

  const pairKey = canonicalPairKey_(rowObj.Person1ID, rowObj.Person2ID);
  if (pairKey) {
    ctx.familyByPairKey[pairKey] = rowObj;
  }

  if (rowObj.Person1ID) {
    if (!ctx.familiesByPersonId[rowObj.Person1ID]) ctx.familiesByPersonId[rowObj.Person1ID] = [];
    ctx.familiesByPersonId[rowObj.Person1ID].push(rowObj);
  }

  if (rowObj.Person2ID) {
    if (!ctx.familiesByPersonId[rowObj.Person2ID]) ctx.familiesByPersonId[rowObj.Person2ID] = [];
    ctx.familiesByPersonId[rowObj.Person2ID].push(rowObj);
  }

  return familyId;
}

function updateFamilyFieldsWithCtx_(ctx, familyId, updates) {
  const rowObj = ctx.familyById[familyId];
  if (!rowObj) throw new Error('Family tidak ditemukan: ' + familyId);

  const sheetRow = rowObj.__sheetRow;
  if (!sheetRow) throw new Error('Sheet row family tidak ditemukan: ' + familyId);

  Object.keys(updates).forEach(key => {
    const col = ctx.familyHeaders.indexOf(key);
    if (col >= 0) {
      ctx.familiesSheet.getRange(sheetRow, col + 1).setValue(updates[key]);
      rowObj[key] = updates[key];
    }
  });
}

function applyFamilyMetaUpdatesWithCtx_(ctx, familyId, familyMeta, now, userEmail) {
  if (!familyId) {
    throw new Error('FamilyID wajib diisi untuk update metadata.');
  }

  const meta = familyMeta || {};
  const updates = {
    UpdatedAt: now || new Date(),
    UpdatedBy: userEmail || ''
  };

  if (Object.prototype.hasOwnProperty.call(meta, 'startYear')) {
    updates.StartYear = toYearOrBlank_(meta.startYear);
  }
  if (Object.prototype.hasOwnProperty.call(meta, 'endYear')) {
    updates.EndYear = toYearOrBlank_(meta.endYear);
  }
  if (Object.prototype.hasOwnProperty.call(meta, 'isActive')) {
    updates.IsActive = normalizeBool_(meta.isActive);
  }
  if (Object.prototype.hasOwnProperty.call(meta, 'notes')) {
    updates.Notes = String(meta.notes || '');
  }

  updateFamilyFieldsWithCtx_(ctx, familyId, updates);
}

function applyFamilyMetaUpdates_(familyId, familyMeta, now, userEmail) {
  const ctx = buildRelationshipWriteContext_();
  applyFamilyMetaUpdatesWithCtx_(ctx, familyId, familyMeta, now, userEmail);
}

function ensureFamilyFromPairWithCtx_(ctx, personAId, personBId, familyMeta) {
  if (!personAId || !personBId) {
    throw new Error('Pasangan family belum lengkap.');
  }

  const existing = findFamilyByCoupleFromCtx_(ctx, personAId, personBId);
  if (existing) return existing.FamilyID;

  const userEmail = safeUserEmail_();
  const now = new Date();

  return createFamilyWithCtx_(ctx, normalizeFamilyInput_(familyMeta || {}, {
    person1Id: personAId,
    person2Id: personBId,
    relationType: 'Marriage',
    isActive: true,
    createdAt: now,
    createdBy: userEmail
  }));
}

function ensureFamilyFromPair_(personAId, personBId, familyMeta) {
  const ctx = buildRelationshipWriteContext_();
  return ensureFamilyFromPairWithCtx_(ctx, personAId, personBId, familyMeta);
}

/* =========================
   FAMILY CHILD LINK CRUD V2
   ========================= */

function findFamilyChildLinkFromCtx_(ctx, familyId, childId) {
  const key = String(familyId || '') + '::' + String(childId || '');
  return (ctx && ctx.familyChildByPairKey && ctx.familyChildByPairKey[key]) || null;
}

function findFamilyChildLink_(familyId, childId) {
  const ctx = buildRelationshipContext_();
  return findFamilyChildLinkFromCtx_(ctx, familyId, childId);
}

function getNextChildOrderForFamilyFromCtx_(ctx, familyId) {
  const links = (ctx.childrenByFamilyId[familyId] || []);
  if (!links.length) return 1;

  const nums = links
    .map(x => Number(x.ChildOrder || 0))
    .filter(n => !isNaN(n));

  return nums.length ? Math.max.apply(null, nums) + 1 : links.length + 1;
}

function getNextChildOrderForFamily_(familyId) {
  const ctx = buildRelationshipContext_();
  return getNextChildOrderForFamilyFromCtx_(ctx, familyId);
}

function addChildToFamilyWithCtx_(ctx, familyId, childId, childOrder, notes) {
  if (!familyId) throw new Error('FamilyID wajib diisi.');
  if (!childId) throw new Error('ChildID wajib diisi.');

  const existing = findFamilyChildLinkFromCtx_(ctx, familyId, childId);
  if (existing) return existing.LinkID;

  const now = new Date();
  const userEmail = safeUserEmail_();
  const linkId = nextChildLinkIdFromCtx_(ctx);

  const rowObj = {
    LinkID: linkId,
    FamilyID: familyId,
    ChildID: childId,
    ChildOrder: childOrder || getNextChildOrderForFamilyFromCtx_(ctx, familyId),
    Notes: notes || '',
    CreatedAt: now,
    UpdatedAt: now,
    CreatedBy: userEmail,
    UpdatedBy: userEmail
  };

  const rowArray = headersToRowArray_(ctx.familyChildHeaders, rowObj);
  ctx.familyChildrenSheet.appendRow(rowArray);

  rowObj.__sheetRow = ctx.familyChildrenSheet.getLastRow();
  ctx.familyChildren.push(rowObj);

  if (!ctx.childrenByFamilyId[familyId]) ctx.childrenByFamilyId[familyId] = [];
  ctx.childrenByFamilyId[familyId].push(rowObj);

  const pairKey = String(familyId) + '::' + String(childId);
  ctx.familyChildByPairKey[pairKey] = rowObj;

  if (!ctx.familyLinksByChildId[childId]) ctx.familyLinksByChildId[childId] = [];
  ctx.familyLinksByChildId[childId].push(rowObj);

  return linkId;
}

function addChildToFamily_(familyId, childId, childOrder, notes) {
  const ctx = buildRelationshipWriteContext_();
  return addChildToFamilyWithCtx_(ctx, familyId, childId, childOrder, notes);
}

/* =========================
   RELATIONSHIP RESOLVERS V2
   ========================= */

function dedupeByKey_(list, keyFn) {
  const out = [];
  const seen = {};
  (list || []).forEach(item => {
    const k = keyFn(item);
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(item);
  });
  return out;
}

function getPersonFamilies(personId) {
  const ctx = buildRelationshipContext_();
  const person = ctx.personById[personId];
  if (!person) return [];

  const rows = [];
  const familyRows = ctx.familiesByPersonId[personId] || [];

  familyRows.forEach(f => {
    const spouseId = f.Person1ID === personId ? f.Person2ID : f.Person1ID;
    const spouse = spouseId ? ctx.personById[spouseId] : null;

    rows.push({
      source: 'family',
      familyId: f.FamilyID,
      spouseId: spouseId || '',
      spouseName: spouse ? (spouse.DisplayName || spouse.FullName || spouseId) : '',
      relationType: f.RelationType || '',
      startYear: f.StartYear || '',
      endYear: f.EndYear || '',
      isActive: normalizeBool_(f.IsActive),
      notes: f.Notes || ''
    });
  });

  if (person.SpouseID) {
    const spouseId = person.SpouseID;
    const spouse = ctx.personById[spouseId];
    const alreadyExists = rows.some(r => r.spouseId === spouseId);

    if (!alreadyExists) {
      rows.push({
        source: 'legacy',
        familyId: '',
        spouseId: spouseId,
        spouseName: spouse ? (spouse.DisplayName || spouse.FullName || spouseId) : spouseId,
        relationType: 'Legacy',
        startYear: '',
        endYear: '',
        isActive: true,
        notes: 'Dibaca dari Persons.SpouseID'
      });
    }
  }

  return rows.sort((a, b) => {
    const aName = a.spouseName || '';
    const bName = b.spouseName || '';
    return aName.localeCompare(bName, 'id');
  });
}

function getFamilyChildren(familyId) {
  const ctx = buildRelationshipContext_();
  const links = ctx.childrenByFamilyId[familyId] || [];

  const rows = links.map(link => {
    const child = ctx.personById[link.ChildID];
    return {
      linkId: link.LinkID,
      familyId: link.FamilyID,
      childId: link.ChildID,
      childName: child ? (child.DisplayName || child.FullName || link.ChildID) : link.ChildID,
      childOrder: link.ChildOrder || '',
      notes: link.Notes || ''
    };
  });

  return rows.sort((a, b) => Number(a.childOrder || 0) - Number(b.childOrder || 0));
}

function getPersonParentsResolved_(personId) {
  const ctx = buildRelationshipContext_();
  const person = ctx.personById[personId];
  if (!person) return { fatherId: '', motherId: '', source: '' };

  const links = ctx.familyLinksByChildId[personId] || [];
  if (links.length) {
    const family = ctx.familyById[links[0].FamilyID];
    if (family) {
      const p1 = ctx.personById[family.Person1ID];
      const p2 = ctx.personById[family.Person2ID];

      let fatherId = '';
      let motherId = '';

      if (p1 && p1.Gender === 'L') fatherId = p1.PersonID;
      if (p2 && p2.Gender === 'L') fatherId = fatherId || p2.PersonID;
      if (p1 && p1.Gender === 'P') motherId = p1.PersonID;
      if (p2 && p2.Gender === 'P') motherId = motherId || p2.PersonID;

      return {
        fatherId: fatherId,
        motherId: motherId,
        source: 'family'
      };
    }
  }

  return {
    fatherId: person.FatherID || '',
    motherId: person.MotherID || '',
    source: 'legacy'
  };
}

/* =========================
   SUBMIT V2
   ========================= */

function validatePayloadV2_(payload) {
  if (!payload) throw new Error('Payload V2 tidak valid.');

  if (payload.selfMode === 'existing') {
    if (!payload.selfExistingId) {
      throw new Error('Pilih Data Diri existing.');
    }
  } else {
    if (!payload.self || !payload.self.fullName) {
      throw new Error('Data Diri baru wajib diisi.');
    }
  }

  if (payload.spouseMode === 'existing') {
    if (!payload.spouseExistingId) {
      throw new Error('Pilih pasangan existing.');
    }
  } else {
    if (!payload.spouseNew || !payload.spouseNew.fullName) {
      throw new Error('Data pasangan baru wajib diisi.');
    }
  }

  ['self', 'spouseNew'].forEach(k => {
    if (payload[k] && payload[k].birthYear && isNaN(Number(payload[k].birthYear))) {
      throw new Error('Tahun lahir harus berupa angka.');
    }
    if (payload[k] && payload[k].deathYear && isNaN(Number(payload[k].deathYear))) {
      throw new Error('Tahun wafat harus berupa angka.');
    }
    if (payload[k] && payload[k].isDeceased && !payload[k].deathYear) {
      throw new Error('Tahun wafat wajib diisi jika status sudah meninggal.');
    }
    if (
      payload[k] &&
      payload[k].birthYear &&
      payload[k].deathYear &&
      Number(payload[k].deathYear) < Number(payload[k].birthYear)
    ) {
      throw new Error('Tahun wafat tidak boleh lebih kecil dari tahun lahir.');
    }
  });

  if (payload.familyMeta) {
    if (payload.familyMeta.startYear && isNaN(Number(payload.familyMeta.startYear))) {
      throw new Error('Tahun mulai harus berupa angka.');
    }
    if (payload.familyMeta.endYear && isNaN(Number(payload.familyMeta.endYear))) {
      throw new Error('Tahun selesai harus berupa angka.');
    }
    if (
      payload.familyMeta.startYear &&
      payload.familyMeta.endYear &&
      Number(payload.familyMeta.endYear) < Number(payload.familyMeta.startYear)
    ) {
      throw new Error('Tahun selesai tidak boleh lebih kecil dari tahun mulai.');
    }
  }
}

function submitFamilyV2(payload) {
  validatePayloadV2_(payload);

  if (isRecentDuplicateSubmit_('v2', payload, 20)) {
    return {
      ok: false,
      recentDuplicateBlocked: true,
      message: 'Permintaan yang sama baru saja diproses. Cegah submit berulang.'
    };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const now = new Date();
    const userEmail = safeUserEmail_();
    const personCtx = buildDataContext_();
    const relationCtx = buildRelationshipWriteContext_();

    let selfId = '';
    let spouseId = '';
    let familyId = '';

    if (payload.selfMode === 'existing') {
      selfId = payload.selfExistingId || '';
      if (!selfId) {
        throw new Error('Data Diri existing belum dipilih.');
      }
      if (!personCtx.byId[selfId]) {
        throw new Error('Data Diri existing tidak ditemukan.');
      }
    } else {
      selfId = createPersonWithCtx_(personCtx, normalizePersonInput_(payload.self, {
        createdAt: now,
        createdBy: userEmail
      }));
    }

    if (payload.spouseMode === 'existing') {
      spouseId = payload.spouseExistingId || '';
      if (!spouseId) {
        throw new Error('Pasangan existing belum dipilih.');
      }
      if (!personCtx.byId[spouseId]) {
        throw new Error('Pasangan existing tidak ditemukan.');
      }
    } else {
      if (!payload.spouseNew || !payload.spouseNew.fullName) {
        throw new Error('Data pasangan baru wajib diisi.');
      }

      spouseId = createPersonWithCtx_(personCtx, normalizePersonInput_(payload.spouseNew, {
        createdAt: now,
        createdBy: userEmail
      }));
    }

    if (selfId === spouseId) {
      throw new Error('Data Diri dan pasangan tidak boleh sama.');
    }

    const existingFamily = findFamilyByCoupleFromCtx_(relationCtx, selfId, spouseId);
    if (existingFamily) {
      familyId = existingFamily.FamilyID;
      applyFamilyMetaUpdatesWithCtx_(relationCtx, familyId, payload.familyMeta || {}, now, userEmail);
    } else {
      familyId = createFamilyWithCtx_(relationCtx, normalizeFamilyInput_(payload.familyMeta || {}, {
        person1Id: selfId,
        person2Id: spouseId,
        relationType: 'Marriage',
        isActive: payload.familyMeta && Object.prototype.hasOwnProperty.call(payload.familyMeta, 'isActive')
          ? normalizeBool_(payload.familyMeta.isActive)
          : true,
        createdAt: now,
        createdBy: userEmail
      }));
    }

    if (personCtx.byId[selfId]) {
      updatePersonFieldsWithCtx_(personCtx, selfId, {
        IsMarried: true,
        UpdatedAt: now,
        UpdatedBy: userEmail
      });
    }

    if (personCtx.byId[spouseId]) {
      updatePersonFieldsWithCtx_(personCtx, spouseId, {
        IsMarried: true,
        UpdatedAt: now,
        UpdatedBy: userEmail
      });
    }

    const stats = buildDashboardStatsFromRows_(personCtx.rows);

    return {
      ok: true,
      selfId: selfId,
      spouseId: spouseId || null,
      familyId: familyId || null,
      childIds: [],
      peopleCount: stats.peopleCount,
      lastUpdate: stats.lastUpdate,
      generationCount: stats.generationCount
    };
  } finally {
    lock.releaseLock();
  }
}

/* =========================
   V2 MIGRATION & MAINTENANCE
   ========================= */

function auditBackfillFamiliesFromPersons() {
  const people = getAllPeople_();
  const relationCtx = buildRelationshipContext_();

  const spousePairsMissing = [];
  const parentPairsMissing = [];
  const childLinksMissing = [];

  people.forEach(p => {
    const personId = String(p.PersonID || '').trim();
    const spouseId = String(p.SpouseID || '').trim();
    const fatherId = String(p.FatherID || '').trim();
    const motherId = String(p.MotherID || '').trim();

    if (personId && spouseId && personId !== spouseId) {
      const fam = findFamilyByCoupleFromCtx_(relationCtx, personId, spouseId);
      if (!fam) {
        spousePairsMissing.push({
          personId: personId,
          spouseId: spouseId
        });
      }
    }

    if (personId && fatherId && motherId) {
      const fam = findFamilyByCoupleFromCtx_(relationCtx, fatherId, motherId);
      if (!fam) {
        parentPairsMissing.push({
          childId: personId,
          fatherId: fatherId,
          motherId: motherId
        });
      } else {
        const link = findFamilyChildLinkFromCtx_(relationCtx, fam.FamilyID, personId);
        if (!link) {
          childLinksMissing.push({
            familyId: fam.FamilyID,
            childId: personId
          });
        }
      }
    }
  });

  return {
    ok: true,
    spousePairsMissingCount: spousePairsMissing.length,
    parentPairsMissingCount: parentPairsMissing.length,
    childLinksMissingCount: childLinksMissing.length,
    spousePairsMissingSample: spousePairsMissing.slice(0, 20),
    parentPairsMissingSample: parentPairsMissing.slice(0, 20),
    childLinksMissingSample: childLinksMissing.slice(0, 20)
  };
}

function backfillFamiliesFromPersons() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const people = getAllPeople_();
    const relationCtx = buildRelationshipWriteContext_();
    const now = new Date();
    const userEmail = safeUserEmail_() || 'system-backfill';

    let createdFamilies = 0;
    let createdChildLinks = 0;

    people.forEach(p => {
      const personId = String(p.PersonID || '').trim();
      const spouseId = String(p.SpouseID || '').trim();

      if (!personId || !spouseId) return;
      if (personId === spouseId) return;

      const existing = findFamilyByCoupleFromCtx_(relationCtx, personId, spouseId);
      if (!existing) {
        createFamilyWithCtx_(relationCtx, normalizeFamilyInput_({}, {
          person1Id: personId,
          person2Id: spouseId,
          relationType: 'Legacy',
          isActive: true,
          notes: 'Auto-backfill dari Persons.SpouseID',
          createdAt: now,
          createdBy: userEmail
        }));
        createdFamilies++;
      }
    });

    people.forEach(p => {
      const childId = String(p.PersonID || '').trim();
      const fatherId = String(p.FatherID || '').trim();
      const motherId = String(p.MotherID || '').trim();

      if (!childId) return;

      if (fatherId && motherId) {
        let family = findFamilyByCoupleFromCtx_(relationCtx, fatherId, motherId);
        let familyId = '';

        if (!family) {
          familyId = createFamilyWithCtx_(relationCtx, normalizeFamilyInput_({}, {
            person1Id: fatherId,
            person2Id: motherId,
            relationType: 'ParentPair',
            isActive: true,
            notes: 'Auto-backfill dari Persons.FatherID + MotherID',
            createdAt: now,
            createdBy: userEmail
          }));
          createdFamilies++;
        } else {
          familyId = family.FamilyID;
        }

        const existingLink = findFamilyChildLinkFromCtx_(relationCtx, familyId, childId);
        if (!existingLink) {
          addChildToFamilyWithCtx_(relationCtx, familyId, childId, null, 'Auto-backfill dari Persons');
          createdChildLinks++;
        }
      }
    });

    return {
      ok: true,
      createdFamilies: createdFamilies,
      createdChildLinks: createdChildLinks,
      familiesCount: relationCtx.families.length,
      familyChildrenCount: relationCtx.familyChildren.length
    };
  } finally {
    lock.releaseLock();
  }
}

function rebuildFamilyChildrenFromPersons() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const people = getAllPeople_();
    const relationCtx = buildRelationshipWriteContext_();

    let createdFamilies = 0;
    let createdChildLinks = 0;

    people.forEach(p => {
      const childId = String(p.PersonID || '').trim();
      const fatherId = String(p.FatherID || '').trim();
      const motherId = String(p.MotherID || '').trim();

      if (!childId || !fatherId || !motherId) return;

      let fam = findFamilyByCoupleFromCtx_(relationCtx, fatherId, motherId);
      let familyId = '';

      if (!fam) {
        familyId = createFamilyWithCtx_(relationCtx, normalizeFamilyInput_({}, {
          person1Id: fatherId,
          person2Id: motherId,
          relationType: 'ParentPair',
          isActive: true,
          notes: 'Rebuilt dari Persons',
          createdAt: new Date(),
          createdBy: safeUserEmail_() || 'system-rebuild'
        }));
        createdFamilies++;
      } else {
        familyId = fam.FamilyID;
      }

      const existingLink = findFamilyChildLinkFromCtx_(relationCtx, familyId, childId);
      if (!existingLink) {
        addChildToFamilyWithCtx_(relationCtx, familyId, childId, null, 'Rebuilt dari Persons');
        createdChildLinks++;
      }
    });

    return {
      ok: true,
      createdFamilies: createdFamilies,
      createdChildLinks: createdChildLinks
    };
  } finally {
    lock.releaseLock();
  }
}

/* =========================
   OPTIONAL HELPERS V2 FOR UI
   ========================= */

function getPersonFamiliesSummary(personId) {
  personId = String(personId || '').trim();
  if (!personId) return [];

  const rows = getPersonFamilies(personId);

  return rows.map(r => ({
    source: r.source || '',
    familyId: r.familyId || '',
    spouseId: r.spouseId || '',
    spouseName: r.spouseName || '',
    relationType: r.relationType || '',
    startYear: r.startYear || '',
    endYear: r.endYear || '',
    isActive: !!r.isActive,
    notes: r.notes || ''
  }));
}

function repairPersonCounter_() {
  const props = PropertiesService.getScriptProperties();

  const ids = getAllPeople_()
    .map(r => String(r.PersonID || ''))
    .filter(Boolean)
    .map(id => Number(id.replace(/^P/, '')))
    .filter(x => !isNaN(x));

  const maxInSheet = ids.length ? Math.max.apply(null, ids) : 0;
  props.setProperty('LAST_PERSON_COUNTER', String(maxInSheet));

  return {
    ok: true,
    lastPersonCounter: maxInSheet
  };
}

function repairPersonCounter() {
  return repairPersonCounter_();
}

function checkPersonCounter() {
  const val = PropertiesService.getScriptProperties().getProperty('LAST_PERSON_COUNTER');
  Logger.log('LAST_PERSON_COUNTER = ' + val);
  return val;
}

function getFamiliesIndex() {
  const ctx = buildRelationshipContext_();

  return ctx.families.map(f => {
    const p1 = ctx.personById[f.Person1ID];
    const p2 = ctx.personById[f.Person2ID];

    return {
      familyId: f.FamilyID,
      person1Id: f.Person1ID || '',
      person1Name: p1 ? (p1.DisplayName || p1.FullName || f.Person1ID) : '',
      person2Id: f.Person2ID || '',
      person2Name: p2 ? (p2.DisplayName || p2.FullName || f.Person2ID) : '',
      relationType: f.RelationType || '',
      startYear: f.StartYear || '',
      endYear: f.EndYear || '',
      isActive: normalizeBool_(f.IsActive),
      notes: f.Notes || ''
    };
  });
}

function ensureFamilyAndLinkChildIfPossibleWithCtx_(ctx, fatherId, motherId, childId, noteText) {
  fatherId = String(fatherId || '').trim();
  motherId = String(motherId || '').trim();
  childId = String(childId || '').trim();

  if (!fatherId || !motherId || !childId) {
    return {
      familyId: '',
      linked: false,
      reason: 'fatherId / motherId / childId belum lengkap'
    };
  }

  const familyId = ensureFamilyFromPairWithCtx_(ctx, fatherId, motherId, {
    relationType: 'ParentPair',
    isActive: true,
    notes: 'Auto-created dari submitFamily'
  });

  const existingLink = findFamilyChildLinkFromCtx_(ctx, familyId, childId);
  if (existingLink) {
    return {
      familyId: familyId,
      linked: false,
      reason: 'link sudah ada'
    };
  }

  addChildToFamilyWithCtx_(ctx, familyId, childId, null, noteText || 'Auto-link dari submitFamily');

  return {
    familyId: familyId,
    linked: true,
    reason: ''
  };
}

function ensureFamilyAndLinkChildIfPossible_(fatherId, motherId, childId, noteText) {
  const ctx = buildRelationshipWriteContext_();
  return ensureFamilyAndLinkChildIfPossibleWithCtx_(ctx, fatherId, motherId, childId, noteText);
}

/* =========================
   FAMILY TREE VIEW
   ========================= */

function buildPersonTreeNode_(person) {
  if (!person) return null;

  return {
    id: person.PersonID || '',
    name: person.DisplayName || person.FullName || person.PersonID || '',
    gender: person.Gender || '',
    birthYear: person.BirthYear || '',
    deathYear: person.DeathYear || ''
  };
}

function sortChildLinks_(links) {
  return (links || []).slice().sort((a, b) => {
    const aOrder = Number(a.ChildOrder || 0);
    const bOrder = Number(b.ChildOrder || 0);

    if (aOrder && bOrder && aOrder !== bOrder) return aOrder - bOrder;
    if (aOrder && !bOrder) return -1;
    if (!aOrder && bOrder) return 1;

    const aId = String(a.ChildID || '');
    const bId = String(b.ChildID || '');
    return aId.localeCompare(bId, 'id');
  });
}

function getFamilySpouseId_(family, personId) {
  if (!family || !personId) return '';
  return family.Person1ID === personId
    ? (family.Person2ID || '')
    : (family.Person1ID || '');
}

function getFamilyChildrenNodesFromCtx_(ctx, familyId) {
  const links = sortChildLinks_(ctx.childrenByFamilyId[familyId] || []);

  return links.map(link => {
    const child = ctx.personById[link.ChildID];
    if (!child) return null;

    return {
      id: child.PersonID || '',
      name: child.DisplayName || child.FullName || child.PersonID || '',
      childOrder: link.ChildOrder || '',
      notes: link.Notes || ''
    };
  }).filter(Boolean);
}

function getPersonFamilyBranchesFromCtx_(ctx, personId, options) {
  const opts = options || {};
  const includeInactive = opts.includeInactive !== false;

  let families = (ctx.familiesByPersonId[personId] || []).slice();
  families = dedupeByKey_(families, f => f.FamilyID);

  if (!includeInactive) {
    families = families.filter(f => normalizeBool_(f.IsActive));
  }

  families.sort((a, b) => {
    const aStart = Number(a.StartYear || 0);
    const bStart = Number(b.StartYear || 0);

    if (aStart && bStart && aStart !== bStart) return aStart - bStart;
    if (aStart && !bStart) return -1;
    if (!aStart && bStart) return 1;

    const aId = String(a.FamilyID || '');
    const bId = String(b.FamilyID || '');
    return aId.localeCompare(bId, 'id');
  });

  return families.map(family => {
    const spouseId = getFamilySpouseId_(family, personId);
    const spouse = spouseId ? ctx.personById[spouseId] : null;

    return {
      familyId: family.FamilyID || '',
      relationType: family.RelationType || '',
      startYear: family.StartYear || '',
      endYear: family.EndYear || '',
      isActive: normalizeBool_(family.IsActive),
      notes: family.Notes || '',
      spouse: buildPersonTreeNode_(spouse),
      grandchildren: getFamilyChildrenNodesFromCtx_(ctx, family.FamilyID)
    };
  });
}

function resolveParentsFromFamily_(ctx, family) {
  const p1 = ctx.personById[family.Person1ID] || null;
  const p2 = ctx.personById[family.Person2ID] || null;

  let father = null;
  let mother = null;

  if (p1 && p1.Gender === 'L') father = p1;
  if (p2 && p2.Gender === 'L') father = father || p2;
  if (p1 && p1.Gender === 'P') mother = p1;
  if (p2 && p2.Gender === 'P') mother = mother || p2;

  return {
    father: buildPersonTreeNode_(father),
    mother: buildPersonTreeNode_(mother),
    person1: buildPersonTreeNode_(p1),
    person2: buildPersonTreeNode_(p2)
  };
}

function getFamilyTreeView(familyId) {
  familyId = String(familyId || '').trim();
  if (!familyId) {
    throw new Error('FamilyID wajib diisi.');
  }

  const ctx = buildRelationshipContext_();
  const family = ctx.familyById[familyId];

  if (!family) {
    throw new Error('Family tidak ditemukan: ' + familyId);
  }

  const parents = resolveParentsFromFamily_(ctx, family);
  const childLinks = sortChildLinks_(ctx.childrenByFamilyId[familyId] || []);

  const children = childLinks.map(link => {
    const child = ctx.personById[link.ChildID];
    if (!child) return null;

    return {
      id: child.PersonID || '',
      name: child.DisplayName || child.FullName || child.PersonID || '',
      gender: child.Gender || '',
      childOrder: link.ChildOrder || '',
      notes: link.Notes || '',
      families: getPersonFamilyBranchesFromCtx_(ctx, child.PersonID, {
        includeInactive: true
      })
    };
  }).filter(Boolean);

  return {
    familyId: family.FamilyID || '',
    relationType: family.RelationType || '',
    startYear: family.StartYear || '',
    endYear: family.EndYear || '',
    isActive: normalizeBool_(family.IsActive),
    notes: family.Notes || '',
    parents: parents,
    children: children
  };
}
