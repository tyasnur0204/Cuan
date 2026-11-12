package id.cuan.app

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

data class ParsedPaymentResult(
  val appKey: String,
  val appName: String,
  val packageName: String,
  val type: String,
  val amount: Double,
  val category: String,
  val transactionDate: String,
  val notes: String,
  val rawTitle: String,
  val rawText: String,
  val postTime: Long
)

object CuanPaymentParser {
  data class AppDef(
    val key: String,
    val shortName: String,
    val packages: Set<String>,
    val defaultCategoryIncome: String
  )

  private val MONITORED_APPS = listOf(
    AppDef("spay", "ShopeePay", setOf("com.shopeepay.id", "com.shopee.id"), "Pemasukan ShopeePay"),
    AppDef("seabank", "SeaBank", setOf("id.co.bankbkemobile.digitalbank"), "Dana Masuk Bank"),
    AppDef("dana", "DANA", setOf("id.dana"), "Pemasukan DANA"),
    AppDef("gopay", "GoPay", setOf("com.gojek.gopay", "com.gojek.app"), "Pemasukan GoPay"),
    AppDef("brimo", "BRImo", setOf("id.co.bri.brimo"), "Dana Masuk Bank")
  )

  val ALL_PACKAGES: Set<String> = MONITORED_APPS.flatMap { it.packages }.toSet()

  private val BLOCKED_KEYWORDS = listOf(
    "promo",
    "diskon",
    "cashback",
    "voucher",
    "klaim voucher",
    "gratis ongkir",
    "flash sale",
    "keranjang",
    "sedang dikemas",
    "sedang dikirim",
    "menuju alamat",
    "kode otp",
    "kode verifikasi",
    "jangan beritahu",
    "rahasia",
    "mpin",
    "menunggu pembayaran",
    "belum dibayar",
    "jatuh tempo",
    "segera bayar",
    "yuk bayar",
    "s.d rp",
    "s/d rp",
    "hingga rp",
    "koin shopee",
    "ajukan sekarang",
    "limit pinjaman",
    "cicilan",
    "dana cicil",
    "undian",
    "menangkan"
  )

  private val CONFIRMATION_KEYWORDS = listOf(
    "berhasil",
    "sukses",
    "selesai",
    "telah masuk",
    "dana masuk",
    "transfer masuk",
    "saldo bertambah",
    "baru saja membayar",
    "telah membayar",
    "berhasil membayar",
    "terbayar",
    "dikredit",
    "didebet",
    "telah mentransfer",
    "pembayaran qris",
    "pembayaran briva",
    "pembayaran gopay",
    "pembayaran shopeepay",
    "kiriman uang",
    "mutasi kredit",
    "mutasi debit"
  )

  private val INCOME_KEYWORDS = listOf(
    "dana masuk",
    "transfer masuk",
    "uang masuk",
    "saldo bertambah",
    "bertambah rp",
    "menerima dana",
    "menerima transfer",
    "menerima kiriman",
    "kiriman uang",
    "kamu menerima",
    "anda menerima",
    "dikredit",
    "mutasi kredit",
    "bunga tabungan",
    "pencairan dana",
    "pembayaran diterima",
    "dana diterima",
    "top up diterima"
  )

  private val EXPENSE_KEYWORDS = listOf(
    "pembayaran berhasil",
    "berhasil membayar",
    "baru saja membayar",
    "telah membayar",
    "kamu membayar",
    "kamu bayar",
    "membayar",
    "bayar ",
    "transfer berhasil",
    "transfer ke",
    "telah mentransfer",
    "kirim uang",
    "transfer keluar",
    "pembelian",
    "tarik tunai",
    "penarikan",
    "didebet",
    "mutasi debit",
    "briva",
    "tagihan terbayar"
  )

  private val AMOUNT_REGEX = Regex("(?i)(?:rp\\.?|idr)\\s*(\\d+(?:[.,]\\d+)*)")
  private val BALANCE_BEFORE_REGEX = Regex(
    "(?i)(?:sisa\\s+saldo|saldo\\s+anda|saldo\\s+akhir|saldo\\s+saat\\s+ini|total\\s+saldo|saldo\\s+sekarang|saldo\\s+tersedia|cashback|hemat|potongan|diskon|hingga|maksimal|s\\.?d\\.?)\\s*(?:[a-z\\s]{0,16})$"
  )

  private val EWALLET_TARGETS_REGEX = Regex("(?i)(gopay|dana|ovo|shopeepay|linkaja|e-wallet)")
  private val FOOD_REGEX = Regex("(?i)(gofood|shopeefood|grabfood|kopi|kenangan|starbucks|resto|warung|makan|cafe|alfamart|indomaret|supermarket)")
  private val TRANSPORT_REGEX = Regex("(?i)(goride|gocar|grab|transport|parkir|tol|pertamina|bensin|bbm|kereta|kai|mrt|transjakarta)")
  private val BILLS_REGEX = Regex("(?i)(pln|listrik|pdam|wifi|internet|telkom|indihome|pulsa|paket data|bpjs|tagihan)")
  private val ENT_REGEX = Regex("(?i)(netflix|spotify|bioskop|xxi|game|hiburan)")
  private val TRANSFER_REGEX = Regex("(?i)(transfer|kirim uang|sesama bank|antar bank)")

  private fun parseFormattedRupiah(rawDigits: String): Double? {
    var normalized = rawDigits.trim()
      .replace(Regex("[^\\d.,]"), "")
      .replace(Regex("^[.,]+|[.,]+$"), "")
    if (normalized.isEmpty()) return null

    normalized = when {
      normalized.contains(Regex("\\.\\d{3}")) && normalized.contains(Regex(",\\d{1,2}$")) ->
        normalized.replace(".", "").replace(",", ".")
      normalized.contains(Regex(",\\d{3}")) && normalized.contains(Regex("\\.\\d{1,2}$")) ->
        normalized.replace(",", "")
      normalized.matches(Regex("^\\d{1,3}(\\.\\d{3})+$")) ->
        normalized.replace(".", "")
      normalized.matches(Regex("^\\d{1,3}(,\\d{3})+$")) ->
        normalized.replace(",", "")
      normalized.matches(Regex("^\\d+,\\d{1,2}$")) ->
        normalized.replace(",", ".")
      else -> normalized.replace(Regex("[.,]"), "")
    }

    val value = normalized.toDoubleOrNull() ?: return null
    if (value.isNaN() || value.isInfinite() || value <= 0.0 || value > 1_000_000_000_000.0) {
      return null
    }
    return (value * 100.0).roundToInt() / 100.0
  }

  private fun extractAmount(text: String): Double? {
    var fallback: Double? = null
    for (m in AMOUNT_REGEX.findAll(text)) {
      val token = m.groupValues.getOrNull(1) ?: continue
      val amt = parseFormattedRupiah(token) ?: continue
      if (amt < 100.0) continue
      val start = maxOf(0, m.range.first - 40)
      val before = text.substring(start, m.range.first)
      if (!BALANCE_BEFORE_REGEX.containsMatchIn(before)) {
        return amt
      }
      if (fallback == null) {
        fallback = amt
      }
    }
    return fallback
  }

  private fun inferCategory(app: AppDef, txType: String, lower: String): String {
    if (txType == "Income") {
      if (lower.contains("qris") || lower.contains("pembeli") || lower.contains("merchant") || lower.contains("penjualan")) {
        return "Pemasukan Usaha"
      }
      if (lower.contains("gaji") || lower.contains("payroll")) {
        return "Gaji"
      }
      if (lower.contains("bunga")) {
        return "Bunga & Imbal Hasil"
      }
      return app.defaultCategoryIncome
    }

    return when {
      FOOD_REGEX.containsMatchIn(lower) -> "Makan & Minum"
      TRANSPORT_REGEX.containsMatchIn(lower) -> "Transport"
      BILLS_REGEX.containsMatchIn(lower) -> "Tagihan & Utilitas"
      ENT_REGEX.containsMatchIn(lower) -> "Hiburan"
      TRANSFER_REGEX.containsMatchIn(lower) -> "Transfer & Pembayaran"
      else -> "Belanja & Pembayaran"
    }
  }

  fun parse(
    packageName: String,
    title: String,
    text: String,
    bigText: String,
    postTime: Long
  ): ParsedPaymentResult? {
    val pkg = packageName.trim().lowercase(Locale.ROOT)
    val app = MONITORED_APPS.firstOrNull { it.packages.contains(pkg) } ?: return null

    val cleanTitle = title.trim()
    val body = bigText.ifBlank { text }.trim()
    val combined = "$cleanTitle $body".replace(Regex("\\s+"), " ").trim()
    if (combined.isEmpty()) return null

    val lower = combined.lowercase(Locale.ROOT)
    if (BLOCKED_KEYWORDS.any { lower.contains(it) }) {
      return null
    }

    if (!CONFIRMATION_KEYWORDS.any { lower.contains(it) }) {
      return null
    }

    val amount = extractAmount(combined) ?: return null

    val isBankApp = app.key == "seabank" || app.key == "brimo"
    val isTopUp = lower.contains("top up") || lower.contains("topup") || lower.contains("isi saldo")

    var txType = when {
      INCOME_KEYWORDS.any { lower.contains(it) } -> "Income"
      EXPENSE_KEYWORDS.any { lower.contains(it) } -> "Expense"
      isTopUp -> if (isBankApp) "Expense" else "Income"
      else -> "Expense"
    }

    if (isBankApp && isTopUp && EWALLET_TARGETS_REGEX.containsMatchIn(lower)) {
      txType = "Expense"
    }

    val category = inferCategory(app, txType, lower)
    val ts = if (postTime > 0L) postTime else System.currentTimeMillis()
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    sdf.timeZone = TimeZone.getDefault()
    val txDate = sdf.format(Date(ts))

    val snippet = body.ifBlank { cleanTitle }
    val truncated = if (snippet.length > 140) snippet.take(137) + "..." else snippet

    return ParsedPaymentResult(
      appKey = app.key,
      appName = app.shortName,
      packageName = pkg,
      type = txType,
      amount = amount,
      category = category,
      transactionDate = txDate,
      notes = "[Auto ${app.shortName}] $truncated",
      rawTitle = cleanTitle,
      rawText = snippet,
      postTime = ts
    )
  }
}
