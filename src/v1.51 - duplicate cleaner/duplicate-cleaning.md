# 🧬 Panduan Membersihkan Duplicate Data di Persons

Panduan ini digunakan untuk membersihkan data duplikat di `Persons` tanpa merusak relasi ke:
- `Families`
- `FamilyChildren`

---

## 🎯 Tujuan

- Menghapus data orang yang double input  
- Menjaga relasi keluarga tetap konsisten  
- Menghindari broken reference setelah cleanup  

---

## 🧭 Alur Kerja

### 1. Backup Data (WAJIB)

Sebelum melakukan apapun, jalankan:

backupAllFamilySheets()

Ini akan menyimpan snapshot semua sheet:
- Persons  
- Families  
- FamilyChildren  

---

### 2. Scan Kandidat Duplikat

Jalankan:

findDuplicateCandidates()

Hasil:
- Sheet baru / refresh: `DuplicateReview`

---

### 3. Review di `DuplicateReview`

Terdapat 2 tipe kandidat:

- **STRICT** → Data sangat identik → aman untuk merge  
- **LOOSE** → Mirip, tapi perlu review manual  

---

### 4. Pahami Kolom Penting

- **KeepPersonID** → ID yang dipertahankan  
- **CandidatePersonID** → ID kandidat duplikat  
- **ActionSuggestion** → Rekomendasi sistem  
- **Decision** → Input manual (MERGE / kosong)  
- **ManualNote** → Catatan tambahan  

---

### 5. Isi Keputusan Manual

Di kolom `Decision`:

- isi **MERGE** → untuk kandidat yang ingin digabung  
- kosongkan → jika belum yakin  
- opsional: **SKIP** → untuk tandai abaikan  

**Contoh:**

- Keeper (misal P0051) → kosong  
- P0054 → MERGE  
- P0057 → MERGE  

---

### 6. (Opsional) Perbaiki Data Dulu

Jika ada data yang salah di `Persons`, perbaiki dulu:

- BirthYear  
- FatherID / MotherID  
- SpouseID  
- Notes  

Setelah itu jalankan ulang:

findDuplicateCandidates()

Keputusan (`Decision`) dan catatan (`ManualNote`) akan tetap tersimpan.

---

### 7. Jalankan Merge

Setelah yakin, jalankan:

mergeDuplicatePersonsSafe()

---

## ⚙️ Apa yang Dilakukan Merge

### Pada `Persons`
- Menggabungkan duplikat ke keeper  
- Update referensi:
  - FatherID  
  - MotherID  
  - SpouseID  

---

### Pada `Families`
- Update:
  - Person1ID  
  - Person2ID  
- Menghapus family duplicate (jika jadi identik)  

---

### Pada `FamilyChildren`
- Update:
  - ChildID  
  - FamilyID  
- Menghapus duplicate child link  
- Mengurutkan ulang `ChildOrder`  

---

### Tambahan
- Log ke `MergeLog`  
- Update counter `LAST_PERSON_COUNTER`  

---

## ✅ Verifikasi Setelah Merge

### 1. ID Lama Hilang
Pastikan ID yang di-merge sudah tidak muncul di:
- Persons  
- Families  
- FamilyChildren  

---

### 2. Relasi Tetap Benar
Cek:
- parent  
- spouse  
- children  

---

### 3. Tidak Ada Duplicate Baru
Cek:
- Families  
- FamilyChildren  

---

## ⚠️ Rule Aman

### Boleh di-MERGE jika:
- Nama sama  
- Gender sama  
- BirthYear sama  
- Father & Mother sama  

---

### Jangan di-MERGE jika:
- Parent berbeda  
- Spouse berbeda  
- Data historis tidak jelas  

---

## 🔁 Workflow Singkat

backupAllFamilySheets()  
findDuplicateCandidates()  

→ Review di sheet  
→ Isi Decision = MERGE  

mergeDuplicatePersonsSafe()  

---

## 💡 Best Practice

- Merge bertahap (jangan semua sekaligus)  
- Mulai dari kasus yang paling jelas  
- Selalu backup sebelum merge  
- Review hasil setelah setiap batch  

---

## 🚀 Tips Tambahan

Kasus duplicate paling umum:
- double click submit  
- koneksi lambat  
- user submit berulang  

Contoh pola:
- P0051, P0054, P0057  

Biasanya ini kandidat merge yang aman.

---

## 🧾 Catatan

- `findDuplicateCandidates()` aman dijalankan ulang  
- `Decision` dan `ManualNote` tidak akan hilang saat scan ulang  
- Merge hanya berjalan untuk baris dengan `Decision = MERGE`  

---

**Status: ✅ Siap dipakai untuk operasional cleanup data**
