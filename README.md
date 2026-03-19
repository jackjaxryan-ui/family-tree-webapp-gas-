# Family Tree Web App (Google Apps Script)

This repository is a **personal development log** for building a Family Tree web application using Google Apps Script and Google Sheets.

It documents the evolution from a simple data-entry form into a more structured genealogy data system.

---

## Overview

The project focuses on:

* Collecting family data via a web form
* Structuring relationships in a scalable way
* Preparing data for future genealogy integration (e.g. GEDCOM / external tools)

---

## Current Architecture

The project has evolved from a flat `Persons` model into a normalized structure:

* **Persons** → individual records
* **Families** → relationship (couple) entity
* **FamilyChildren** → child linkage

This enables:

* Multiple spouses
* Cleaner parent-child relationships
* Better support for tree visualization

---

## What Makes It Interesting

* **Family-based model** instead of simple SpouseID
* **Duplicate detection + safe merge tools**
* **Migration utilities** from legacy structure
* Early-stage **tree view implementation**

---

## Current Working Version

Active development is currently in:

`src/v1.51 - duplicate cleaner`

This version includes:

* Family-based relationship system
* Duplicate detection and merge module
* Tree view enhancements

---

## Repository Structure

* `src/` → versioned development builds
* `docs/` → architecture, schema, and notes
* `examples/` → sample data

This structure reflects iterative development rather than a finalized production layout.

---

## Notes

This repository is not intended as a polished production app.

It is primarily used to:

* Explore data modeling approaches for genealogy
* Test relationship logic and edge cases
* Build a foundation for future export and integration

---

## Next Direction

* GEDCOM export
* Improved tree visualization
* More robust relationship editing

---
