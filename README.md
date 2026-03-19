# Family Tree Web App (Google Apps Script)

This repository is a **personal development log** for building a simple web-based intake tool to collect family relationship data.

The goal is to make it easy for end-users to input structured family data, which can later be processed and integrated into genealogy platforms (e.g. via GEDCOM, FamilyEcho, etc.).

---

## Overview

This project focuses on:

* Providing a simple form for family data input
* Structuring relationships in a consistent and scalable way
* Preparing clean data for downstream genealogy systems

It is not intended to replace full-featured family tree platforms.

---

## Current Architecture

The data model has evolved from a flat `Persons` structure into a more normalized approach:

* **Persons** → individual records
* **Families** → relationship (couple) entity
* **FamilyChildren** → child linkage

This allows:

* Multiple spouses
* Clear parent-child relationships
* Better compatibility with tree-based systems

---

## What Makes It Interesting

* Designed as a **data intake layer**, not a full genealogy app
* Uses a **family-based relationship model** instead of simple SpouseID
* Includes **duplicate detection and safe merge tools**
* Provides **migration utilities** from earlier data structures

---

## Current Working Version

Active development is currently in:

`src/v1.51 - duplicate cleaner`

This version includes:

* Family-based relationship system
* Duplicate detection and merge module
* Initial tree view support

---

## Repository Structure

* `src/` → versioned development builds
* `docs/` → architecture and schema notes
* `examples/` → sample data

This structure reflects iterative development rather than a finalized production layout.

---

## Notes

This repository is not intended as a polished production system.

It is primarily used to:

* Explore genealogy data modeling
* Validate relationship logic
* Prepare structured data for external platforms

---

## Next Direction

* GEDCOM export pipeline
* Integration workflow with FamilyEcho
* Improved data validation and cleanup tools

---
