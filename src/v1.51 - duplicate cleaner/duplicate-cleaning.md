# 🧬 Duplicate Cleanup Guide (Persons)

This guide explains how to clean duplicate records in `Persons` without breaking relationships in:
- `Families`
- `FamilyChildren`

---

## 🎯 Purpose

- Remove duplicate person entries  
- Preserve family relationships  
- Prevent broken references  

---

## 🧭 Workflow

### 1. Backup (Required)

Run:

backupAllFamilySheets()

Creates a snapshot of:
- Persons  
- Families  
- FamilyChildren  

---

### 2. Scan for Duplicates

Run:

findDuplicateCandidates()

Output:
- `DuplicateReview` sheet

---

### 3. Review Candidates

Two types:

- **STRICT** → highly identical → safe to merge  
- **LOOSE** → similar → requires manual review  

---

### 4. Key Columns

- **KeepPersonID** → selected keeper  
- **CandidatePersonID** → duplicate candidate  
- **ActionSuggestion** → system hint  
- **Decision** → MERGE / empty  
- **ManualNote** → optional notes  

---

### 5. Set Decision

In `Decision` column:

- **MERGE** → approve merge  
- empty → skip / undecided  
- optional: **SKIP**

**Example:**
- Keeper → leave empty  
- Duplicates → set MERGE  

---

### 6. (Optional) Fix Data First

Correct data in `Persons` if needed:
- BirthYear  
- FatherID / MotherID  
- SpouseID  
- Notes  

Then rerun:

findDuplicateCandidates()

Decisions and notes are preserved.

---

### 7. Run Merge

Run:

mergeDuplicatePersonsSafe()

---

## ⚙️ What Merge Does

### Persons
- Merge duplicates into keeper  
- Update:
  - FatherID  
  - MotherID  
  - SpouseID  

---

### Families
- Update:
  - Person1ID  
  - Person2ID  
- Remove duplicate family rows  

---

### FamilyChildren
- Update:
  - ChildID  
  - FamilyID  
- Remove duplicate links  
- Reorder `ChildOrder`  

---

### Additional
- Logs to `MergeLog`  
- Updates `LAST_PERSON_COUNTER`  

---

## ✅ Post-Merge Checks

1. Old IDs are gone  
   - Persons  
   - Families  
   - FamilyChildren  

2. Relationships are correct  
   - parent  
   - spouse  
   - children  

3. No new duplicates  
   - Families  
   - FamilyChildren  

---

## ⚠️ Safe Merge Rules

Merge if:
- Same name  
- Same gender  
- Same birth year  
- Same parents  

Do NOT merge if:
- Different parents  
- Different spouse  
- Unclear history  

---

## 🔁 Quick Workflow

backupAllFamilySheets()  
findDuplicateCandidates()  

→ Review  
→ Set Decision = MERGE  

mergeDuplicatePersonsSafe()  

---

## 💡 Best Practices

- Merge in small batches  
- Start with obvious duplicates  
- Always backup first  
- Verify after each merge  

---

## 🚀 Common Cause

Duplicates often come from:
- double-click submit  
- slow connection  
- repeated user input  

Example:
- P0051, P0054, P0057  

---

## 🧾 Notes

- `findDuplicateCandidates()` is safe to rerun  
- `Decision` and `ManualNote` are preserved  
- Only rows with `Decision = MERGE` are processed  

---

**Status: ✅ Ready for operational use**
