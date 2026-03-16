/**
 * Family Tree Web App - Google Apps Script starter
 * Backend: Google Sheets
 * Sheet required: Persons
 */
const SPREADSHEET_ID = '17I8THF855K9tbIWBgh44aD3vd4ZZL2xa8P3Ye31u-og';
const PERSONS_SHEET = 'Persons';

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
   META / DASHBOARD
   ========================= */

function getDatabaseName() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
    if (!last || dt > last) {
      last = dt;
    }
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
    if (visiting[personId]) return 1; // antisipasi cycle

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
  return rows
    .filter(r => r.PersonID && r.FullName)
    .map(r => ({
      id: r.PersonID,
      fullName: r.FullName,
      displayName: r.DisplayName || buildDisplayName_(r.FullName, r.BirthYear),
      gender: r.Gender || '',
      birthYear: r.BirthYear || '',
      spouseId: r.SpouseID || '',
      fatherId: r.FatherID || '',
      motherId: r.MotherID || ''
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'id'));
}

/* =========================
   MAIN SUBMIT
   ========================= */

function submitFamily(payload) {
  validatePayload_(payload);

  // duplicate check hanya untuk mode NEW, kecuali user sudah konfirmasi forceCreate
  if (!payload.forceCreate) {
    const duplicateWarnings = collectDuplicateWarnings_(payload);
    if (duplicateWarnings.length) {
      return {
        ok: false,
        needsConfirm: true,
        duplicateWarnings: duplicateWarnings
      };
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const now = new Date();
    const userEmail = safeUserEmail_();

    // baca sheet sekali
    const ctx = buildDataContext_();

    let fatherId = payload.fatherMode === 'existing' ? (payload.fatherExistingId || '') : '';
    let motherId = payload.motherMode === 'existing' ? (payload.motherExistingId || '') : '';
    let selfId = '';
    let spouseId = '';

    validateParentGenderFromCtx_(fatherId, motherId, ctx);

    if (payload.fatherMode === 'new' && payload.fatherNew && payload.fatherNew.fullName) {
      fatherId = createPersonWithCtx_(ctx, normalizePersonInput_(payload.fatherNew, {
        gender: 'L',
        createdAt: now,
        createdBy: userEmail
      }));
    }

    if (payload.motherMode === 'new' && payload.motherNew && payload.motherNew.fullName) {
      motherId = createPersonWithCtx_(ctx, normalizePersonInput_(payload.motherNew, {
        gender: 'P',
        createdAt: now,
        createdBy: userEmail
      }));
    }

    // Jika Ayah dan Ibu sama-sama ada, otomatis link sebagai pasangan
    if (fatherId && motherId) {
      const fatherRow = ctx.byId[fatherId];
      const motherRow = ctx.byId[motherId];

      if (fatherRow && (!fatherRow.SpouseID || fatherRow.SpouseID === motherId)) {
        updatePersonFieldsWithCtx_(ctx, fatherId, {
          IsMarried: true,
          SpouseID: motherId,
          UpdatedAt: now,
          UpdatedBy: userEmail
        });
      }

      if (motherRow && (!motherRow.SpouseID || motherRow.SpouseID === fatherId)) {
        updatePersonFieldsWithCtx_(ctx, motherId, {
          IsMarried: true,
          SpouseID: fatherId,
          UpdatedAt: now,
          UpdatedBy: userEmail
        });
      }
    }

    // SELF: existing atau new
    if (payload.selfMode === 'existing') {
      selfId = payload.selfExistingId || '';
      if (!selfId) {
        throw new Error('Data diri existing belum dipilih.');
      }

      const selfRow = ctx.byId[selfId];
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
        updatePersonFieldsWithCtx_(ctx, selfId, updates);
      }
    } else {
      selfId = createPersonWithCtx_(ctx, normalizePersonInput_(payload.self, {
        fatherId: fatherId,
        motherId: motherId,
        createdAt: now,
        createdBy: userEmail
      }));
    }

    // Pasangan self
    if (payload.selfHasSpouse && payload.spouse && payload.spouse.fullName) {
      const selfRow = ctx.byId[selfId];
      if (!selfRow) {
        throw new Error('Data diri tidak ditemukan saat memproses pasangan.');
      }

      if (selfRow.SpouseID) {
        spouseId = selfRow.SpouseID;
      } else {
        spouseId = createPersonWithCtx_(ctx, normalizePersonInput_(payload.spouse, {
          createdAt: now,
          createdBy: userEmail,
          isMarried: true,
          spouseId: selfId
        }));

        updatePersonFieldsWithCtx_(ctx, selfId, {
          IsMarried: true,
          SpouseID: spouseId,
          UpdatedAt: now,
          UpdatedBy: userEmail
        });
      }
    } else {
      const selfRow = ctx.byId[selfId];
      spouseId = selfRow && selfRow.SpouseID ? selfRow.SpouseID : '';
    }

    // Anak-anak dari self
    const childIds = [];
    const selfGender = getSelfGenderFromCtx_(payload, selfId, ctx);

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

      childIds.push(createPersonWithCtx_(ctx, childInput));
    });

    const stats = buildDashboardStatsFromRows_(ctx.rows);

    return {
      ok: true,
      selfId: selfId,
      fatherId: fatherId || null,
      motherId: motherId || null,
      spouseId: spouseId || null,
      childIds: childIds,
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
   DATA CONTEXT (OPTIMIZED)
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
        obj.__sheetRow = idx + 2; // nomor row real di spreadsheet
        return obj;
      });

  const byId = {};
  rows.forEach(r => {
    if (r.PersonID) byId[r.PersonID] = r;
  });

  return {
    sheet: sheet,
    headers: headers,
    rows: rows,
    byId: byId
  };
}

function createPersonWithCtx_(ctx, p) {
  const id = nextPersonId_();
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
      rowObj[key] = value; // update cache memori juga
    }
  });

  // jaga DisplayName kalau FullName/BirthYear berubah
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

function getPersonsSheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('Set SPREADSHEET_ID di Code.gs terlebih dahulu.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PERSONS_SHEET);
  if (!sheet) throw new Error('Sheet "Persons" tidak ditemukan.');
  return sheet;
}

function nextPersonId_() {
  const props = PropertiesService.getScriptProperties();
  const key = 'LAST_PERSON_COUNTER';
  let n = Number(props.getProperty(key) || '0');

  if (n === 0) {
    const ids = getAllPeople_()
      .map(r => String(r.PersonID || ''))
      .filter(Boolean)
      .map(id => Number(id.replace(/^P/, '')))
      .filter(x => !isNaN(x));

    n = ids.length ? Math.max.apply(null, ids) : 0;
  }

  n += 1;
  props.setProperty(key, String(n));
  return 'P' + Utilities.formatString('%04d', n);
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
   DUPLICATE DETECTION
   ========================= */

function normalizeNameForCompare_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDuplicateCandidates_(personInput, roleLabel) {
  const fullName = String((personInput && personInput.fullName) || '').trim();
  const gender = String((personInput && personInput.gender) || '').trim();
  const birthYear = personInput && personInput.birthYear ? Number(personInput.birthYear) : '';

  if (!fullName || !gender) return [];

  const normalizedInputName = normalizeNameForCompare_(fullName);
  const all = getAllPeople_();

  const scored = all.map(p => {
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

function collectDuplicateWarnings_(payload) {
  const warnings = [];

  if (payload.fatherMode === 'new' && payload.fatherNew && payload.fatherNew.fullName) {
    const candidates = findDuplicateCandidates_(
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
    const candidates = findDuplicateCandidates_(
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
    const candidates = findDuplicateCandidates_(payload.self, 'Data Diri');
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

/* =========================
   RESET DATA
   ========================= */

function resetFamilyData() {
  const email = safeUserEmail_();
  const allowed = ['rdiditfa@gmail.com'];

  if (!allowed.includes(email)) {
    throw new Error('Anda tidak punya izin untuk reset data.');
  }

  const sheet = getPersonsSheet_();
  const data = sheet.getDataRange().getValues();

  if (data.length > 1) {
    sheet.getRange(2, 1, data.length - 1, data[0].length).clearContent();
  }

  PropertiesService.getScriptProperties().deleteProperty('LAST_PERSON_COUNTER');

  return {
    ok: true,
    peopleCount: 0,
    lastUpdate: '-',
    generationCount: 0
  };
}
