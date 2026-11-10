System Design Document (SDD)

Aplikasi Manajemen Keuangan Mahasiswa



1\. Pendahuluan

•	Tujuan: Mendefinisikan arsitektur dan spesifikasi teknis untuk aplikasi manajemen keuangan personal yang dirancang khusus untuk mahasiswa tingkat menengah. Aplikasi ini bertujuan mengelola arus kas dari uang saku, proyek freelance (seperti drafting AutoCAD atau operasional photobooth), serta memantau pertumbuhan aset investasi untuk mengalahkan tingkat inflasi.

•	Ruang Lingkup: Aplikasi akan mencakup pencatatan transaksi masuk/keluar, zero-based budgeting, pelacakan portofolio investasi (RDPU, SBN, Saham), dan dasbor analitik komparasi nilai aset terhadap inflasi tahunan.

2\. Tinjauan Sistem \& Teknologi (Tech Stack)

Mengingat pendekatan pengembangan yang sering menggunakan vibe coding dengan AI (Cursor, Windsurf), tumpukan teknologi dipilih berdasarkan kemudahan scaffolding dan dukungan komunitas yang masif.

•	Frontend (Web/Mobile App): React.js (Web) atau Flutter (Mobile) untuk antarmuka yang responsif.

•	Backend (API): Python menggunakan kerangka kerja FastAPI. Sangat efisien, mendukung asinkron, dan mudah dimodelkan untuk perhitungan matematis/statistik.

•	Database: PostgreSQL (Relasional) untuk menjaga integritas data transaksi keuangan yang ketat.

•	Hosting/Deployment: VPS Linux (seperti Ubuntu Server) menggunakan kontainerisasi Docker.

3\. Arsitektur Sistem

Sistem menggunakan arsitektur Client-Server standar dengan pemisahan antara antarmuka pengguna, logika bisnis (API), dan penyimpanan data.

•	Presentation Layer (Client): Menampilkan visualisasi data (grafik pie chart pengeluaran, grafik garis pertumbuhan aset).

•	Application Layer (FastAPI): Menangani logika zero-based budgeting, kalkulasi compound interest dari investasi, dan mengkategorikan transaksi.

•	Data Layer (PostgreSQL): Menyimpan seluruh entri finansial.

4\. Desain Database (Skema Relasional)

Tabel Users

•	id (UUID, Primary Key)

•	username (Varchar)

•	email (Varchar)

•	created\_at (Timestamp)

Tabel Accounts

•	id (UUID, Primary Key)

•	user\_id (UUID, Foreign Key)

•	name (Varchar) - cth: "Gopay", "Bank BCA", "Bibit RDPU"

•	type (Enum: Cash, Bank, Investment)

•	balance (Decimal)

Tabel Transactions

•	id (UUID, Primary Key)

•	account\_id (UUID, Foreign Key)

•	type (Enum: Income, Expense, Transfer)

•	category (Varchar)

•	amount (Decimal)

•	transaction\_date (Date)

•	notes (Text)

Tabel Budgets

•	id (UUID, Primary Key)

•	user\_id (UUID, Foreign Key)

•	category (Varchar)

•	limit\_amount (Decimal)

•	month (Int)

•	year (Int)

Tabel Investment\_Assets

•	id (UUID, Primary Key)

•	user\_id (UUID, Foreign Key)

•	asset\_name (Varchar)

•	asset\_class (Enum: RDPU, SBN, Saham)

•	annual\_return\_rate (Decimal)

5\. Desain API (Endpoints)

•	GET /api/v1/dashboard/summary: Mengembalikan total aset, pengeluaran bulan ini, dan sisa budget.

•	POST /api/v1/transactions: Mencatat pemasukan atau pengeluaran baru (memperbarui balance pada Accounts).

•	GET /api/v1/transactions?month=11\&year=2026: Menarik histori transaksi bulanan.

•	POST /api/v1/budgets: Menetapkan batas pengeluaran per kategori di awal bulan.

•	GET /api/v1/investments/inflation-check: Mengkalkulasi nilai aset saat ini dikurangi target inflasi tahunan (misal: 3.2%) untuk melihat pertumbuhan aset riil.

6\. Desain Antarmuka Pengguna (UI/UX)

•	Dasbor Utama (Beranda): Menampilkan sisa kas operasional vs. batas budget. Menampilkan metrik "Pertumbuhan Bersih (Setelah Inflasi)".

•	Halaman Transaksi: Formulir input cepat (tanggal, nominal, kategori, akun sumber). Memiliki mode khusus untuk pemasukan bisnis (freelance atau usaha fisik).

•	Halaman Anggaran (Budgeting): Mengadopsi prinsip zero-based, di mana total pemasukan bulan tersebut dialokasikan ke masing-masing "amplop" hingga bersisa Rp0.

•	Halaman Portofolio: Grafik garis (line chart) yang membandingkan garis pertumbuhan investasi dengan garis inflasi riil untuk memvalidasi strategi keuangan.

7\. Kebutuhan Non-Fungsional \& Keamanan

•	Performa: Endpoint dasbor utama harus merespons di bawah 500ms agar aplikasi terasa ringan.

•	Keamanan: Autentikasi berbasis JWT (JSON Web Tokens). Semua password pengguna dienkripsi menggunakan hashing bcrypt.

•	Skalabilitas: API didesain stateless sehingga memungkinkan peningkatan spesifikasi server atau penambahan node jika sistem ingin di-hosting dan dibuka untuk publik di masa depan.



