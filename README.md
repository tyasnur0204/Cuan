# FinMate — Aplikasi Manajemen Keuangan Mahasiswa

**FinMate** adalah aplikasi web manajemen keuangan personal dan usaha sampingan untuk mahasiswa (seperti proyek *freelance* maupun usaha mandiri). Aplikasi ini menggabungkan pencatatan arus kas harian, *zero-based budgeting*, laporan keuangan, analisis portofolio investasi terhadap laju inflasi tahunan, serta integrasi **Machine-to-Machine (M2M)** berbasis API Key untuk pencatatan pemasukan usaha secara otomatis.

---

## Fitur Utama

### 1. Dashboard Ringkas
- Ringkasan **Total Aset**, **Saldo Kas**, **Pemasukan Bulan Ini**, dan **Pengeluaran Bulan Ini**.
- Kartu **Pertumbuhan Bersih (Setelah Inflasi)** untuk melihat selisih return portofolio terhadap asumsi inflasi tahunan.
- Indikator progres **Sisa Budget Bulan Ini**.
- Grafik batang **Arus Kas Bulanan** (6 bulan terakhir) dan daftar **Transaksi Terbaru**.

### 2. Transaksi & Mode Usaha
- Mendukung 3 tipe transaksi: **Income** (Pemasukan), **Expense** (Pengeluaran), dan **Transfer** antar akun (otomatis memperbarui saldo akun sumber & tujuan).
- Mode transaksi usaha (`is_business`) untuk memisahkan arus kas bisnis/freelance dari keuangan pribadi.
- Filter berdasarkan tipe, bulan, kategori, akun, pencarian kata kunci, paginasi tabel, dan hapus transaksi dengan pembalikan saldo otomatis.

### 3. Budgeting (*Zero-Based Budgeting*)
- Penetapan batas anggaran per kategori untuk bulan dan tahun tertentu.
- Diagram donat distribusi anggaran dengan total pemasukan berada di tengah grafik.
- Banner status alokasi yang menunjukkan persentase teralokasi hingga sisa alokasi mencapai **Rp 0**.

### 4. Portofolio Investasi & Cek Inflasi
- Pelacakan aset investasi dengan kelas **RDPU**, **SBN**, dan **Saham** beserta nilai investasinya (`invested_amount`).
- Perbandingan grafis (*Line Chart*) antara return tahunan setiap aset dengan target laju inflasi (default `3.2%`, dapat disesuaikan di menu Pengaturan).
- Diagram donat **Alokasi Aset** berdasarkan kelas aset dan status apakah aset mampu mengalahkan inflasi.

### 5. Laporan Keuangan
- Tab **Ringkasan**, **Pengeluaran**, **Pemasukan**, dan **Perbandingan** per periode bulan/tahun.
- Grafik rincian kategori pengeluaran & pemasukan serta tabel perbandingan arus kas 6 bulan terakhir.

### 6. Pengaturan & Integrasi M2M
- Manajemen **Profil Pengguna** dan pembaruan **Password**.
- Pengelolaan **Akun Keuangan** (`Cash`, `Bank`, `Investment`, dan penanda `is_business_account`).
- Pengaturan asumsi **Laju Inflasi Tahunan (%)** secara lokal (`localStorage`).
- Pembuatan, aktivasi/nonaktif, dan penghapusan **API Key M2M (`X-API-Key`)** agar aplikasi atau sistem eksternal dapat mengirim transaksi pemasukan otomatis tanpa login JWT.

---

## Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Backend API** | Python 3.10+, FastAPI, Uvicorn, Pydantic |
| **ORM & Database** | SQLAlchemy, PostgreSQL (`psycopg2`) |
| **Keamanan** | JWT (`python-jose`), Hashing Bcrypt (`bcrypt`), M2M `X-API-Key` |
| **Frontend Web** | React 18, Vite 6, React Router DOM v6, Axios |
| **UI & Visualisasi** | Tailwind CSS v3 (Emerald `#067F5B`, Navy `#142C4B`, Bg `#F4F7F5`, Font `Inter`), Recharts |
| **Deployment** | Docker (`Dockerfile`), Render Blueprint (`render.yaml`) |

---

## Struktur Proyek

```text
Cuan/
├── app/
│   ├── __init__.py
│   ├── auth.py          # JWT auth & dependency verify_api_key (X-API-Key)
│   ├── crud.py          # Operasi CRUD database & mutasi saldo atomik
│   ├── database.py      # Konfigurasi koneksi PostgreSQL & SessionLocal
│   ├── main.py          # Entrypoint FastAPI, CORS, skema startup & seluruh endpoint API
│   ├── models.py        # Model SQLAlchemy (6 tabel relasional)
│   └── schemas.py       # Skema validasi request/response Pydantic
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Budgets.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Layout.jsx        # Sidebar desktop, header pencarian, & mobile bottom nav
│   │   │   ├── Login.jsx         # Login & registrasi akun
│   │   │   ├── Portfolio.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Transactions.jsx
│   │   ├── services/
│   │   │   └── api.js            # Konfigurasi Axios + interceptor JWT
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── Dockerfile
├── render.yaml
├── requirements.txt
└── README.md
```

---

## Skema Database PostgreSQL

Tabel otomatis dibuat saat aplikasi backend dijalankan pertama kali (`Base.metadata.create_all`):

1. **`users`** — `id` (UUID PK), `username`, `email`, `hashed_password`, `created_at`
2. **`accounts`** — `id` (UUID PK), `user_id` (FK), `name`, `type` (`Cash` | `Bank` | `Investment`), `balance`, `is_business_account`
3. **`transactions`** — `id` (UUID PK), `account_id` (FK), `type` (`Income` | `Expense` | `Transfer`), `category`, `amount`, `transaction_date`, `notes`, `is_business`
4. **`budgets`** — `id` (UUID PK), `user_id` (FK), `category`, `limit_amount`, `month`, `year`
5. **`investment_assets`** — `id` (UUID PK), `user_id` (FK), `asset_name`, `asset_class` (`RDPU` | `SBN` | `Saham`), `annual_return_rate`, `invested_amount`
6. **`api_keys`** — `id` (UUID PK), `key_string` (bcrypt hash), `name`, `is_active`

---

## Ringkasan API Endpoints

Dokumentasi interaktif tersedia di **`http://localhost:8000/docs`** (Swagger UI).

### Auth & Profil
- `POST /api/v1/register` — Registrasi pengguna baru
- `POST /api/v1/login` — Login dan mendapatkan token JWT (`Bearer`)
- `GET /api/v1/me` — Mengambil profil pengguna yang sedang login
- `PUT /api/v1/me` — Memperbarui `username` atau `email`
- `PUT /api/v1/me/password` — Mengubah password pengguna

### Akun, Transaksi, & Budget
- `GET /api/v1/accounts`, `POST /api/v1/accounts`, `DELETE /api/v1/accounts/{account_id}`
- `GET /api/v1/transactions`, `POST /api/v1/transactions`, `DELETE /api/v1/transactions/{transaction_id}`
- `GET /api/v1/budgets`, `POST /api/v1/budgets`, `DELETE /api/v1/budgets/{budget_id}`

### Dashboard, Laporan, & Investasi
- `GET /api/v1/dashboard/summary` — KPI ringkasan, pertumbuhan riil vs inflasi, arus kas 6 bulan, transaksi terbaru
- `GET /api/v1/reports/summary` — Rekap bulanan, breakdown kategori, perbandingan 6 bulan
- `GET /api/v1/investments/inflation-check` — Kalkulasi *net real return* dan alokasi kelas aset
- `POST /api/v1/investments`, `DELETE /api/v1/investments/{asset_id}`

### Integrasi M2M (Webhook Eksternal)
- `GET /api/v1/api-keys`, `POST /api/v1/api-keys`, `PATCH /api/v1/api-keys/{key_id}/toggle`, `DELETE /api/v1/api-keys/{key_id}` *(Auth JWT)*
- `POST /api/v1/transactions/auto-log` *(Auth Header `X-API-Key`)* — Mencatat pemasukan otomatis sebagai tipe `"Income"`, kategori `"Pemasukan Usaha"`, dan akun bisnis (`is_business_account=True`).

Contoh pemanggilan M2M:

```bash
curl -X POST "http://localhost:8000/api/v1/transactions/auto-log" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: fm_xxxxxxxxxxxxxxxxx" \
  -d '{"nominal": 35000, "tanggal": "2026-11-10"}'
```

---

## Cara Menjalankan Secara Lokal

### Prasyarat
- **Python 3.10+**
- **Node.js 18+** dan `npm`
- **PostgreSQL** berjalan dengan database bernama `cuan_db`

### 1. Konfigurasi Variabel Lingkungan (Opsional)
Secara default backend menggunakan:
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cuan_db`
- `JWT_SECRET_KEY=finmate-secret-key-change-in-production-2026`

Dan frontend menggunakan:
- Mode *development* (`npm run dev`): default `http://localhost:8000/api/v1` (atau `VITE_API_URL`)
- Mode *production build* (`npm run build`): default `/api/v1` (*same-origin* ketika dilayani oleh FastAPI), atau override dengan `VITE_API_URL` jika frontend di-host terpisah.

Atur variabel lingkungan tersebut sesuai kebutuhan sebelum menjalankan aplikasi di environment produksi.

### 2. Jalankan Backend (FastAPI)

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend akan aktif di `http://localhost:8000` (Swagger UI di `http://localhost:8000/docs`).

### 3. Jalankan Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend akan aktif di `http://localhost:3000`.

Untuk mem-build bundel produksi frontend:

```bash
cd frontend
npm run build
```

---

## Deployment ke Web Publik

Repositori ini menggunakan **multi-stage [`Dockerfile`](./Dockerfile)** (build React frontend dengan Node 20 lalu menyajikan hasilnya bersama FastAPI dalam **satu URL publik** beserta PostgreSQL).

- **Render (Blueprint `render.yaml`)**: Deploy 1-klik melalui [`render.yaml`](./render.yaml) (otomatis membuat web service `finmate-web` + managed database `finmate-db`), atau buka:
  `https://render.com/deploy?repo=https://github.com/tyasnur0204/Cuan`
- **Railway**: Hubungkan repositori GitHub ini di Railway lalu tambahkan plugin **PostgreSQL** (`DATABASE_URL` & `JWT_SECRET_KEY` otomatis terdeteksi).
- **Mode Single-Server Lokal**: Setelah menjalankan `npm run build` di folder `frontend/`, FastAPI di `http://localhost:8000` juga langsung menyajikan antarmuka web di `/`.
