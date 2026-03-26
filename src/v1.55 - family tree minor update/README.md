# Code.gs — v1.55

## Focus of This Version

This version consolidates previous work into a more stable backend with emphasis on:

- normalized relationships (`Families` + `FamilyChildren`)
- safer submit flow
- stronger duplicate handling
- safe merge operations
- improved tree view output

---

## Key Improvements

### 1. Safer Submit Flow
- validation before insert  
- duplicate warning (pre-create)  
- recent-submit protection (cache)  
- script locking (race condition protection)  

---

### 2. Duplicate Handling (End-to-End)
- scan candidates → `findDuplicateCandidates()`  
- review in `DuplicateReview`  
- controlled merge → `mergeDuplicatePersonsSafe()`  
- optional backup → `backupAllFamilySheets()`  

Merge handles:
- ID remapping across all tables  
- family + child deduplication  
- prevention of broken references  

---

### 3. Relationship Model (Stabilized)
Fully aligned on:

- `Persons`
- `Families`
- `FamilyChildren`

Enables:
- multiple spouses  
- cleaner parent-child grouping  
- better downstream processing  

---

### 4. Tree View (Refined)
Function:
- `getFamilyTreeView(familyId)`

Minor improvements:
- child sorting priority:
  1. `BirthYear`
  2. `ChildOrder`
  3. `ChildID`
- more consistent family ordering  
- more readable branch structure  

---

### 5. Migration Support
Utilities retained and aligned with current model:

- `auditBackfillFamiliesFromPersons()`  
- `backfillFamiliesFromPersons()`  
- `rebuildFamilyChildrenFromPersons()`  

---

## What Changed vs Previous Versions

This version is not a new concept, but a **consolidation**:

- tree view + duplicate cleaner + normalized model  
- now working together in a single script  
- with safer write + cleanup behavior  

---

## Scope

This script is focused on:

- data intake  
- normalization  
- cleanup  
- preparation for export (future GEDCOM / FamilyEcho flow)  

Not intended as a full genealogy system.

---

## Notes

This file intentionally avoids repeating details already documented in `src/`.

Treat this as the **current working state** of the backend.
