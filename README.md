<img width="1080" height="1080" alt="atlantixfinance" src="https://github.com/user-attachments/assets/95c6b600-5a0c-4a5c-ae97-83aa9a410843" />

# Atlantix Finance

Duygularınla işlem yapıp para mı kaybediyorsun? Kendi hedge fonunun senin için çalıştığını hayal et. Atlantix Finance, 13 yapay zeka ajanından oluşan yatırım komitendir. Fikirlerini acımasızca tartışır, haberleri analiz eder ve riskleri keserler. Artık tahmin yürütmek yok. Sadece soğukkanlı hesaplama, disiplin ve mutlak sermaye koruması.

# Özet: Sistem neyi çözüyor ve tüm bunların amacı ne?

Sorun 1: Kararların duygularla alınması → 13 ajandan oluşan komite seni yapılandırılmış düşünmeye zorlar. "İyi bir fikir gibi görünüyor, alayım" diyemezsin — bir tez, tetikleyici ve geçersiz kılma (invalidation) şartı yazmak zorundasın.

Sorun 2: Analist ekibinin olmaması → 13 ajan bir ekibin yerini alır: temel analist, ayı, makro stratejist, quant, haber analisti, opsiyon masası, flow (akış) yatırımcısı, uyumluluk ve risk yöneticisi.

Sorun 3: Risk yönetiminin göz ardı edilmesi → Risk Yöneticisi her zaman son sözü söyler. Diğer herkes onaylasa bile o REJECT (Reddet) diyebilir. Kill Switch tek bir butonla her şeyi durdurur. Stoplar otomatik olarak takip edilir.

Sorun 4: Geçmiş hataların tekrarlanması → Her tartışma, yatırım notu ve post-mortem analizi vektör belleğine (memory) kaydedilir. Araştırma (Research) modülü geçmişteki benzer durumları bulur.

Sorun 5: Piyasa bağlamının olmaması → Macro Radar piyasa rejimini gösterir ve ne yapman gerektiğini söyler. Haberler otomatik olarak değerlendirilir. Knowledge Graph (Bilgi Grafiği) olaylar ile senin pozisyonların arasındaki bağlantıları gösterir.

### Tek Cümleyle Sistemin Amacı:
Atlantix Finance , kaotik bir alım-satım sürecini; her kararın gerekçelendirildiği, belgelendiği ve geçmiş deneyimlerden ders çıkarılan yapılandırılmış bir sisteme dönüştürür.


## Stack

- **Frontend** — React 19, TanStack Start, TanStack Router, Tailwind CSS v4
- **UI** — shadcn/ui (Radix UI primitives), Recharts, Framer Motion
- **Backend** — Supabase (Postgres, Auth, Edge Functions), Cloudflare Workers
- **AI Agents** — Gemini-powered agents (CIO, Macro, Risk, Fundamental, Bear, Quant, News, Execution, Portfolio, Options, Flow, Memory, Operations)
- **i18n** — English / Turkish

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run committee` | Run investment committee script |

## Project Structure

```
src/
├── components/
│   ├── atlantix/     # App-specific components (agents, memo, gates, etc.)
│   └── ui/           # shadcn/ui base components
├── routes/           # TanStack Router file-based routes
├── hooks/            # Custom React hooks
├── integrations/
│   └── supabase/     # Supabase client & auth
├── i18n/             # Translations (en, tr)
└── lib/              # Utilities

supabase/
├── functions/        # Edge Functions (agent-chat, scoring, market data, etc.)
└── migrations/       # Database migrations
```






# Atlantix Finance
Tek bir operatör (isteğe bağlı/discretionary işlemler yapan yatırımcı) için tasarlanmış otonom bir yatırım komitesi terminalidir. Sistem, bir analist ekibinin yerini alır: Google Gemini tabanlı 13 yapay zeka ajanı her işlem fikrini tartışır, riskleri kontrol eder ve bir karar verir — ancak nihai karar her zaman insana aittir.

# KİMLER İÇİN?
## Hedef müşteri tek bir kişidir:
1.Kendi sermayesiyle işlem yapan discretionary yatırımcı
2.Analist ekibi olmayan Family office Portföy Yöneticisi (PM)
3.Yapılandırılmış bir süreç isteyen Prop desk yatırımcısı
4.BIST + ABD piyasalarında işlem yapan Türk yatırımcı

## Sistemin çözdüğü temel sorunlar:
9 analisti çalıştıracak zaman/para eksikliği
Kararların yapıdan yoksun, duygularla alınması
Geçmiş işlemlerin unutulması ve aynı hataların tekrarlanması
Risk yönetiminin bir kontrol noktası (gate) değil, sonradan akla gelen bir detay (afterthought) olması

Haberlerin ve makro verilerin belirli pozisyonlarla ilişkilendirilmemesi

# MİMARİ
## Veri Akışı:
Frontend (React + Vite + TanStack Router)
↓
Supabase (PostgreSQL + Realtime + Deno üzerinde Edge Functions)
↓
Harici API'ler: Gemini, FRED, Yahoo Finance, NewsAPI, Finnhub

Teknoloji Yığını (Stack):

### Frontend: React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Framer Motion

### Backend: Supabase Edge Functions (Deno/TypeScript) — 21 fonksiyon

### Veritabanı: Supabase üzerinden Satır Seviyesi Güvenliği (RLS) ile PostgreSQL

### Yapay Zeka (AI): Google Gemini 2.5 Flash (ajanlar) + Gemini 2.5 Pro (Risk Yöneticisi)

### Embeddings: RAG belleği için Google text-embedding-004

### Realtime: Canlı tartışmalar için Supabase Realtime (WebSocket)

### i18n: i18next — İngilizce (EN) ve Türkçe (TR) dilleri

# TÜM SAYFALAR
### 1. Command Center (/dashboard)
Neleri gösterir (veritabanından gerçek zamanlı veriler):
Açık pozisyon sayısı (long/short dağılımı) → tıklama → Portfolio
Aktif fikir sayısı, kaç tanesinin onay beklediği → tıklama → Debate Room
Risk Officer'ın son kararı (APPROVE/REDUCE_SIZE/REJECT) → tıklama → Risk
Sistem durumu (Healthy/Degraded/Issues) → tıklama → System Health
Edge/Risk/Consensus çubuklarıyla Edge Skoruna göre en iyi 5 fikir
Gerçekleşmemiş (unrealized) P&L ile açık pozisyonlar
Operator Bulletin: onay bekleyen fikirler (sarı) + kritik uyarılar (kırmızı)

### 2. Opportunities (/opportunities)
#### Ne yapar:
Tüm fikirlerin Edge Skoruna göre sıralandığı tablo

#### Sütunlar: Ticker, Varlık Sınıfı, Fikir Başlığı, Yön (long/short), Durum, Edge, Risk, Consensus, R/R Asimetrisi
Run butonu — komiteyi doğrudan tablodan başlatır
New Idea butonu — yeni fikir oluşturma penceresi
Fikir adına tıklama → O fikrin Debate Room sayfasına gider

### 3. Debate Room (/debate)
### Sistemin ana sayfası. Ne yapar:

Hızlı geçiş için yatay fikir çubuğu
Conflict Matrix — 13 ajandan 9'unun son duruşunu (FOR/AGAINST/NEUTRAL/CAUTION) ve kısa argümanını gösteren kartlar
Debate Transcript — Live/History sekmeleri:
Live: Ajan ve duruşa göre filtrelenebilir tüm 13 ajanın kompakt mesaj listesi
History: Tüm fikirler üzerinden komitenin geçmiş tartışmaları
Sağ kenar çubuğu: Durum, Skor çubukları (Edge/Risk/Consensus/Timing/Liquidity), R/R Asimetrisi, Risk Kararı, "Ne yapılmalı" bloğu, Yatırım Notu (Investment Memo), Approve/Reject butonları

Re-run Committee butonu — Tüm 13 ajanı yeniden başlatır

### 4. Knowledge Graph (/graph)
### Ne yapar:

İnteraktif SVG grafiği: Varlık → Olay → Fikir → Pozisyon
Kaydırmak için sürükle, yakınlaştırmak için kaydır (scroll)
Düğüme (node) tıklama → detaylar ve eylem butonları içeren panel açılır
Fikir → Debate Room açar
Pozisyon → Portfolio açar
Olay → Haberin kaynağını açar
Üzerine gelme (Hover) → Bağlantılı düğümleri vurgular

### 5. Risk Cockpit (/risk)
### Neleri gösterir:
Aktivasyon butonlu Kill Switch (ENGAGED/DISARMED - AKTİF/DEVRE DIŞI)
Daily Risk Used — Renk göstergeli ilerleme çubuğu
Verdict Distribution — Tüm zamanların APPROVE/REDUCE_SIZE/WAIT/REJECT dağılımı
Sector Concentration — Açık pozisyonların sektörel yoğunlaşması
Positions Without Stop-Loss — Stop-loss olmayan pozisyonların listesi ve "Set Stop" butonu
Market Limits — Piyasalara göre limit tablosu (ABD: max %5 pozisyon, %2 günlük risk; BIST: %4 / %1.5)
Stress Test Results — Stres testi sonuçları
Re-evaluate Risk — Belirli bir fikir için evaluate-risk edge fonksiyonunu çalıştırır
Recent Verdicts — "Debate" butonu ile tüm kararların tablosu

### 6. Portfolio (/portfolio)
### Neleri gösterir:

Toplam Özkaynak, Nakit, Günlük P&L, Kullanılan Günlük Risk
Açık pozisyonlar tablosu: Ticker, Yön, Miktar, Ortalama Fiyat, Güncel Fiyat, NAV % Ağırlığı, Gerçekleşmemiş P&L, SL/TP

Butonlar: Refresh Prices (Yahoo Finance), Sync Broker (Yahoo senkronizasyonu)

### 7. News Intel (/news)
### Ne yapar:

events tablosundan önem skoru (importance score) ve duyarlılık (sentiment) ile etkinlik listesi

Ticker ve minimum önem derecesine göre filtreleme

Ingest News butonu → ingest-news edge fonksiyonunu çalıştırır

Her haber: başlık, kaynak, duyarlılık (-1 ile +1 arası), önem (0-100), bağlantı

### 8. Macro Radar (/macro)
### Neleri gösterir:

Açıklamasıyla birlikte mevcut piyasa rejimi (Bull/Bear/Volatile/Crisis/Neutral)

Playbook — Mevcut rejim için atılacak spesifik adımlar

Rejimin Fikirlerinize Etkisi — Üç sütun: Desteklenenler / Nötr / Karşı Rüzgarlar

Fikre tıklama → Debate Room

ABD Makro (FRED): VIX, Fed Fon Oranı, 10Y/2Y Hazine, Spread, TÜFE (CPI), İşsizlik, DXY, WTI — trend ve eşiklerle

TR Makro (TCMB/TÜİK): Türk makro göstergeleri

Refresh FRED butonu → macro-snapshot çalıştırır

### 9. Watchlist (/watchlist)
### Ne yapar:

All/BIST/ABD filtresiyle izlenen varlıkların listesi
Katılım filtresi — Sadece İslami finansa uygun (assets tablosundaki katilim_compliant alanı) varlıklar
Seed BIST butonu — En iyi BIST hisselerini (THYAO, ASELS, KCHOL, GARAN, AKBNK, BIMAS, EREGL, SISE, TUPRS) otomatik ekler
Promote butonu → Varlıktan bir fikir oluşturur ve Debate Room sayfasını açar
Varlık sınıfı ve tetikleyici not (trigger note) ile yeni ticker ekleme

### 10. Execution Console (/execution)
### Ne yapar:

All/ABD/BIST filtreli emir tablosu
BIST için uyarı: Canlı aracı kurum entegrasyonu yok, sadece paper-trade (sanal işlem)
Mod kilidi: Terminal Modu EXE değilse emir gönderimi engellenir
Switch to EXE butonu — Modu değiştirir
Send butonu → broker-place-order çağırır (Yahoo'dan fiyat alır, pozisyon oluşturur)
Cancel butonu → Emri iptal eder

Yeni emir oluşturma: Ticker, Yön, Tip (Piyasa/Limit), Miktar, Limit Fiyat

### 11. Operations Console (/operations)
### Neleri gösterir (tamamı gerçek):

### 4 kart: Bekleyen Emirler, Uzlaşma Uyuşmazlıkları, Aktif Uyarılar, Son Senkronizasyon

Kapatma (Dismiss) butonlu Kritik Uyarılar (Critical Alerts)
Gönder (Submit) butonlu Bekleyen Emirler → broker-place-order
Pozisyon Uzlaşması (Dahili sistem vs Aracı kurum)
Gerçekleşme fiyatı ve broker emir ID'si ile Emir Geçmişi
Audit Log (Denetim Günlüğü) — Sistemdeki tüm işlemler

#### 12. Alerts (/alerts)
### Neleri gösterir:

Aktif uyarılar: kritik (kırmızı), uyarı (sarı), bilgi (mavi)

Üzerine gelindiğinde (hover) otomatik olarak okundu olarak işaretler

Dismiss (Kapat) butonu

Arşivlenmiş uyarılar

Kısmen sahte (mock): Veritabanında veri yoksa MOCK_ALERTS kullanılır

### 13. Agent Scorecards (/agents)
### Neleri gösterir (agent_debates'ten gerçek veriler):

Toplam Tartışma, En İyi Ajan, İzlenen Ajan, Ortalama Güven (Confidence)

Her ajan için tablo: Turlar, İsabet Oranı (Doğru tahmin yüzdesi), Duruş Karışımı (FOR/AGAINST/NEUTRAL çubuğu), Ort. Güven, Kalibrasyon (haklıyken ne kadar emin vs haksızken ne kadar emin), Ort. Gecikme

### 14. Research (/research)
### Ne yapar:

Ask Memory — research-query aracılığıyla tüm sistem belleğinde semantik arama

Kaynaklara satır içi atıflar [#1], [#2] içeren yanıtlar

Index Note — embed-document aracılığıyla belleğe not ekleme

Fikirlere ait Yatırım Notlarının (Investment Memos) listesi

### 15. Trade Journal (/journal)
### Neleri gösterir:

trade_journal tablosundaki kapanmış işlemler listesi

Agent Accuracy (Ajan İsabeti) — Her işlem için hangi ajanların haklı/haksız olduğu

Run Post-Mortem butonu → generate-postmortem (Gemini, tartışmayı ve sonucu analiz eder)

Satıra tıklama → Tam değerlendirme (post-mortem) diyaloğu: Özet, İşe Yarayanlar, Başarısız Olanlar, Çıkarılan Dersler

Add Trade butonu — İşlemi manuel ekleme (Ticker, Yön, Giriş/Çıkış Fiyatı, Tarihler, Nedenler)

### 16. System Health (/health)
### Neleri gösterir (system_health_log'dan gerçek veriler):

6 bileşen kartı: Piyasa Verileri, Haber Alımı, Makro, Broker Senkronizasyonu, Özellik Deposu (Feature Store), Veritabanı

### Durum: ONLINE/DEGRADED/OFFLINE/FAULT

Live Log Stream — system_health_log içindeki tüm kayıtlar (her 15 saniyede bir otomatik yenilenir)

Run Check butonu → system-health-check

### 17. Settings (/settings)

E-posta, Görünen Ad, Mevcut Rol

## Rol yönetimi: Owner / Operator / Viewer

Sadece Owner (Sahip) rolleri değiştirebilir

KOMİTENİN 13 AJANI
run-committee edge fonksiyonu üzerinden sırayla çalıştırılırlar. Her biri bir önceki tartışma dökümünü bağlam olarak alır:

### Ajan	Rol	Model
1	CIO Opening	Tartışmayı açar, ana soruyu formüle eder	Flash
2	Fundamental Bull	Rakamlar ve değerleme ile tezi oluşturur	Flash
3	Bear (Attack)	Bull'un tezine saldırır, rakamlarını alıntılar	Flash
4	Fundamental Bull (Rebuttal)	Bear'e yanıt verir, tezi netleştirir	Flash
5	Bear (Final)	Bear'in son sözü	Flash
6	Macro Strategist	Piyasa rejimi bağlamını sağlar	Flash
7	Quant Research	Geriye dönük test (Backtest), faktörler, Kelly konumlandırması	Flash
8	News & Sentiment	Kitle konumlandırması, anlatı (narrative)	Flash
9	Options Desk	Zımni oynaklık (IV), çarpıklık (skew), dealer gamma, alternatif ifadeler	Flash
10	Flow	Karanlık havuzlar (Dark pools), ETF akışları, içeriden öğrenenler	Flash
11	Compliance	PASS veya BLOCK — yaptırımlar, çıkar çatışmaları	Flash
12	Risk Officer	Nihai sentez: APPROVE / REDUCE_SIZE / WAIT / REJECT / KILL_SWITCH	Pro
13	CIO Closing Memo	Sonuç: oylar, inanç (conviction), eylem, yeniden gözden geçirme tetikleyicileri	Flash
BİR FİKRİN YAŞAM DÖNGÜSÜ
draft → researching → debating → awaiting_approval → approved → executed → closed
(Ayrıca awaiting_approval sonrasında rejected veya executed sonrasında invalidated olabilir)

draft — New Idea Dialog veya Watchlist'ten Promote ile oluşturulur

debating — Komite çalıştırılır, ajanlar argümanlarını yazar

awaiting_approval — Komite tamamlandı, insan onayı bekliyor

approved — İnsan Approve'a tıkladı → Execution'da emir oluşturulur

rejected — İnsan Reject'e tıkladı → Fikir kapatıldı

executed — Emir gerçekleşti, pozisyon açıldı

closed / invalidated — Pozisyon kapatıldı veya tez geçersiz kılındı

### TERMINAL MODE — DURUM MAKİNESİ
8 mod, terminal_state tablosunda saklanır. Manuel veya otomatik olarak değişir:

Mod	Renk	İzin Verilenler
RESEARCH	Mavi	Sadece araştırma, işlem (execution) yok
WATCH	Açık Mavi	Varlıkların izlenmesi
COMMITTEE	Mor	Ajanlar fikri tartışır
RISK REVIEW	Sarı	Risk kapısı aktiftir, karar bekleniyor
EXECUTION	Yeşil	Emirlerin onaylanması ve gönderilmesi
LIVE	Mor	Açık pozisyonların yönetilmesi
POST-MORTEM	Gri	Kapanmış işlemlerin analizi
EMERGENCY	Kırmızı	Alım satım durduruldu
### Önemli: Mod COMMITTEE veya RISK_REVIEW değilse fikir onaylama (Approve) engellenir. Mod EXECUTION değilse emir gönderimi engellenir.

### SKOR SİSTEMİ
Her komite çalışmasından sonra score-idea edge fonksiyonu tarafından hesaplanır:

Edge Score (0-100) — Fikrin ne kadar güçlü olduğu. Yüksek = güçlü tez, iyi asimetri.

Risk Score (0-100) — Risk seviyesi. Yüksek = tehlikeli.

Consensus Score (0-100) — Ajanların kendi aralarında ne kadar hemfikir olduğu.

Timing Score (0-100) — Giriş zamanlamasının ne kadar iyi olduğu.

Liquidity Score (0-100) — Varlığın likiditesi.

Asymmetry (R) — Risk/Getiri oranı (örn. 3.2R = potansiyel getiri, riskin 3.2 katı).

### BAĞLI API'LER
### Google Gemini 

###Modeller: gemini-2.5-flash, gemini-2.5-pro (Risk Officer)

### Kullanım: 13 komite ajanı, post-mortem oluşturma, Türkçe çeviri, fikir skorlama, haber analizi.

Google text-embedding-004

### Kullanım: RAG belleği için metinlerin vektörizasyonu.

### FRED (Federal Reserve Economic Data)

### Kullanım: ABD makro göstergeleri (Faiz, TÜFE, VIX vb.).

### Yahoo Finance (Anahtarsız)

### Kullanım: Hisse senedi fiyatları (ABD ve .IS uzantısı ile BIST), geçmiş veriler, haberler.

### Finnhub (Opsiyonel)

### Kullanım: Birincil kaynak olarak gerçek zamanlı (real-time) fiyatlandırma.

### NewsAPI (Opsiyonel)

### Kullanım: Ticker'lara göre haberler.

### TCMB EVDS (Türkiye Cumhuriyet Merkez Bankası)

### Kullanım: Türk makro verileri (Faiz, enflasyon, kur).

### KAP (Kamuyu Aydınlatma Platformu)

### Kullanım: Türk kurumsal bildirimleri.

### Alpaca Paper Trading (Opsiyonel)

### Durum: Yahoo Finance senkronizasyonu ile değiştirildi, artık zorunlu değil.

### ROLLER VE ERİŞİM
Owner (Sahip): Her şey (Fikirleri onaylama/reddetme, Kill Switch'i devreye alma, rolleri değiştirme)

Operator (Operatör): Komiteyi başlatma, riski yeniden değerlendirme, emir oluşturma

Viewer (İzleyici): Sadece görüntüleme


# KULLANIM SENARYOSU — ADIM ADIM
Sabah (10 dakika)

Adım 1 — Command Center: /dashboard sayfasını açarsın. 2 açık pozisyon, onay bekleyen 1 fikir olduğunu ve sistemin Healthy (Sağlıklı) olduğunu görürsün. Operator Bulletin'de sarı renkli "AKBNK LONG — onayınızı bekliyor" uyarısı vardır. Review'a (İncele) tıklarsın.

Adım 2 — Macro Radar: Karar vermeden önce /macro sayfasını kontrol edersin. Rejim VOLATILE (Dalgalı). Playbook şöyle der: "Pozisyon büyüklüklerini %30-50 azaltın." Fikirler: AKBNK, Headwinds (Karşı rüzgarlar) sütununda yer alıyor (dalgalı rejimde LONG olmak rüzgara karşı gitmektir).

Yeni Bir Fikrin Araştırılması (30 dakika)

Adım 3 — Watchlist: /watchlist sayfasına gidersin. "LNG sözleşme duyurusu" tetikleyici notuyla THYAO.IS'i listede görürsün. Promote'a tıklarsın → sistem bir fikir oluşturur ve Debate Room'u (Tartışma Odası) açar.

Adım 4 — New Idea Dialog: Şunları doldurursun: Tez (Thesis) "15 yıllık LNG tedarik sözleşmesi FCF'yi 3 katına çıkarıyor", Tetikleyici (Trigger) "2. Çeyrekte sözleşme imzalanması", Geçersiz Kılma (Invalidation) "Sözleşmenin iptal olması veya Brent < $65".

Adım 5 — Debate Room: Re-run Committee (Gemini) butonuna tıklarsın. Ajanların gerçek zamanlı olarak sırayla ortaya çıkmasını izlersin:

CIO tartışmayı açar.

Fundamental Bull rakamlarla tezi destekler.

Bear saldırır: "LNG sözleşme şartları şeffaf değil."

Bull cevap verir.

Macro: "Volatile rejimi — ters rüzgar."

Quant: "Kelly kriteri %2.1 NAV öneriyor."

Risk Officer: "REDUCE_SIZE — %2.5 NAV, $65/varil Brent stop."

Adım 6 — Karar Verme: Sağ kenar çubuğuna bakarsın:

Risk Verdict (Risk Kararı): REDUCE_SIZE (Boyutu Azalt)

"Ne yapılmalı": "Küçültülmüş bir pozisyon boyutuyla gir - %2.5 NAV, stop-loss zorunlu"

Edge Skoru: 71, Risk Skoru: 68, Consensus: 45.

Girmeye karar verir, Approve (Onayla) butonuna basarsın.

Gerçekleştirme (5 dakika)

Adım 7 — Terminal Mode: TerminalModeBar'da modu EXECUTION olarak değiştirirsin.

Adım 8 — Execution Console: /execution sayfasına gidersin. "approved" (onaylandı) durumunda THYAO LONG emrini görürsün. Send (Gönder) butonuna basarsın → sistem mevcut fiyatı Yahoo Finance'ten alır ve veritabanında pozisyonu oluşturur. Ardından bu emri aracı kurumunun uygulamasından manuel olarak gerçekleştirirsin.

# İzleme (Günlük)

Adım 9 — Portfolio: Her gün Refresh Prices'a basarsın → Yahoo tüm pozisyonların fiyatlarını ve P&L'ini günceller.

Adım 10 — Stop-Loss Watcher: Operations altında Run Stop Watcher'a basarsın → sistem tüm stop-loss'ları canlı fiyatlarla kontrol eder. Eğer THYAO stop'un altına düştüyse — bir uyarı oluşturulur ve pozisyon kapalı olarak işaretlenir.

İşlem Kapatıldıktan Sonra

Adım 11 — Trade Journal: /journal sayfasına gidersin. THYAO kapalı işlemini görürsün. Run Post-Mortem'a tıklarsın → Gemini tüm komite tartışmasını ve sonucu analiz eder, şunları yazar: Ne işe yaradı, ne yaramadı, çıkarılan dersler. Bunlar hafızaya kaydedilir.

Adım 12 — Research: Bir ay sonra /research sayfasını açıp sorarsın: "Türk enerji şirketleri hakkında ne biliyoruz?" → sistem THYAO notlarını, tartışmalarını ve post-mortem analizini bulur, alıntılarla cevap verir.

# NEDEN RAKİPLERDEN DAHA İYİ?
Fonksiyon	Atlantix Lab	Bloomberg Terminal	ChatGPT	TradingView
13 Ajan Tartışması	Evet	Hayır	Hayır	Hayır
(Kullanılan Tahmini Kredi: 8.73, Geçen süre: 7dk 18s)

# Atlantix Finace — Yeni Başlayanlar İçin Kılavuz
Önce en önemlisi: Tüm bu sistemin amacı nedir?
Hisse senedi almak istediğini hayal et. Genellikle ya sezgilerinle hareket edersin ("THYAO'nun yükseleceğini duydum"), ya güvenmediğin analizleri okursun ya da sadece tahmin edersin. Sonra para kaybeder ve nedenini anlayamazsın.
Atlantix Lab tek bir sorunu çözer: Yalnız olsan ve bir analist ekibin olmasa bile yatırım kararlarını nasıl yapılandırılmış, duygusal olmayan ve gerçek analizlere dayanan bir şekilde alırsın?
Sistem sana, her fikrini tartışan 13 yapay zeka analistinden oluşan sanal bir yatırım komitesi verir. Biri "al" der, diğeri onun argümanlarına saldırır, bir başkası riskleri kontrol eder. Sonunda Risk Yöneticisi bir karar verir. Ancak son söz her zaman senindir.

Az önce kayıt oldun. Ne görüyorsun?
Bomboş bir Command Center. Her yerde sıfırlar var. Bu normal — sistem boş çünkü henüz hiçbir şey yapmadın. İşte sırasıyla yapman gerekenler:

### Adım 1 — Dili Ayarla
Sağ üstteki dil simgesi olan butona tıkla. Arayüzü Türkçe istiyorsan TR'yi seç. Komiteyi bir sonraki çalıştırışında ajanlar da sana Türkçe yanıt verecektir.

### Adım 2 — İzleme Listene (Watchlist) Varlık Ekle
İzleme Listesi (Watchlist) sayfasına git. Burası takip etmek istediğin hisseleri topladığın yerdir — favorilerin gibi düşünebilirsin.

"Seed BIST" butonuna tıkla — Sistem Türkiye'nin en büyük 9 hissesini otomatik olarak ekler: THYAO, ASELS, KCHOL, GARAN, AKBNK, BIMAS, EREGL, SISE, TUPRS. Bu 2 saniye sürer.

Veya herhangi bir ticker'ı manuel ekle: Add Ticker'a bas, örneğin AAPL (Apple) veya THYAO (Türk Hava Yolları) yaz. Varlık sınıfını (equity/hisse) belirt ve istersen bir tetikleyici not (trigger note) yazabilirsin — bu varlığa neden baktığını ("yeni bir sözleşme duydum" gibi).

### Neden gerekli: İzleme Listen senin radarındır. Karşına çıkan her şeyin ticaretini yapmazsın, belirli varlıkları takip edersin. Sistem haberleri veya makro verileri çekerken, bunu tam olarak İzleme Listendeki varlıklar için yapar.

### Adım 3 — Makro Verileri Çek
Makro Radar sayfasına git. Refresh FRED butonuna bas. Sistem ABD Merkez Bankası'na (Federal Reserve) bağlanır ve gerçek verileri indirir: VIX (piyasa korku endeksi), faiz oranları, enflasyon, petrol, dolar.
10-15 saniye bekle. Rakamların olduğu kartlar belirecektir.

Neden gerekli: Herhangi bir hisse senedi almadan önce piyasanın ne durumda olduğunu anlamalısın. Eğer VIX = 35 ise bu bir krizdir, alım yapmak tehlikelidir. VIX = 13 ise piyasa sakindir, risk alınabilir. Sistem piyasa rejimini otomatik olarak belirler (Bull/Bear/Volatile/Crisis) ve bu rejimde ne yapman gerektiğini sana söyler.

Örneğin rejim VOLATILE ise sistem şöyle diyecektir: "Pozisyon boyutlarını %30-50 küçült, VIX 22'nin altına düşene kadar yeni pozisyon açma." Bu soyut değil, oldukça somut bir tavsiyedir.

### Adım 4 — Haberleri Çek
Haber İstihbaratı (News Intel) sayfasına git. Ingest News butonuna bas. Sistem NewsAPI ve Yahoo Finance üzerinden İzleme Listendeki varlıklarla ilgili son haberleri indirecek ve Gemini aracılığıyla her haberi değerlendirecektir: Ne kadar önemli (0-100) ve olumlu mu yoksa olumsuz mu (-1 ile +1 arası).

Neden gerekli: Haberler hisseleri hareket ettirir. Eğer "THYAO 15 yıllık LNG sözleşmesi imzaladı" haberi %85 önem ve +0.8 duyarlılıkla çıkarsa, bu fikri incelemeye değer bir sinyaldir. Sistem sana sadece başlıkları göstermez, onları senin için değerlendirir.

### Adım 5 — İlk Fikrini Oluştur
Artık elinde veriler var. Diyelim ki THYAO hakkındaki haberi gördün ve "Acaba alsam mı?" diye düşünüyorsun. İşler şöyle yürüyor:
Fırsatlar (Opportunities) sayfasına git. Sağ üstteki New Idea (Yeni Fikir) butonuna tıkla.
Formu doldur:

### Ticker: THYAO

### Side: Long (alıyorum)

### Thesis (Tez): "Türk Hava Yolları, artan turizm ve yeni LNG sözleşmesinden fayda sağlıyor. FCF (Serbest Nakit Akışı) artıyor, değerleme P/E (F/K) bazında ucuz."

### Trigger (Tetikleyici): "LNG sözleşmesinin 2025 2. çeyreğinde imzalanması"

### Invalidation (Geçersiz Kılma): "Sözleşme iptal olursa veya petrol 65 doların altına düşerse"
Create (Oluştur) butonuna bas.

### Neden gerekli: Tez (Thesis), hissenin neden yükseleceğine dair hipotezindir. Tetikleyici (Trigger), tezi doğrulayacak belirli bir olaydır. Geçersiz kılma (Invalidation), yanıldığını kabul edip çıkış yapacağın koşuldur. Bu bir disiplindir. Çoğu yatırımcı ne zaman çıkacağını bilmediği için para kaybeder. Sen bunu en başından belirlersin.

### Adım 6 — Komiteyi Çalıştır
Fikir oluşturuldu. Şimdi Opportunities tablosunda fikrin yanındaki Run (Çalıştır) butonuna bas ya da Tartışma Odası (Debate Room) sayfasına gidip Re-run Committee (Gemini) butonuna tıkla.
3-5 dakika bekle. Bu, sistemin en önemli parçasıdır. Ajanların mesajlarının sırayla nasıl geldiğini göreceksin:

### CIO açılışı yapar: "THYAO LONG fikrini tartışıyoruz. Ana soru LNG sözleşmesinin şartlarının gerçekçi olup olmadığı. Bull, başla."

### Fundamental Bull tezini kurar: "THYAO, yıllık %40 FCF büyümesine rağmen 6x F/K ile işlem görüyor. LNG sözleşmesi gelirlere $2.3B ekliyor. Adil değere göre %35 yükseliş potansiyeli var. Güven: 78"

### Bear saldırır: "Bull $2.3B'den bahsediyor ancak sözleşme şartları şeffaf değil — bu bir 'kara kutu'. Piyasa habere zaten tepki vermiyor (zımni oynaklık/IV artmıyor), bu da şüpheciliği gösteriyor. Güven: 71"

### Bull cevap verir: "Bear şeffaflık konusunda haklı, ancak %70 Net Faiz Geliri (NII) büyümesi enflasyonu zaten geride bırakıyor. 0.5x PD/DD (P/B) iskontosu kur riskini zaten fiyatlıyor."

Macro: "Volatile rejim, long pozisyonlar için bir ters rüzgardır (headwind). Ancak TRY'nin istikrar kazanması THYAO için olumlu."

Quant: "Benzer durumlar: 156 benzer senaryo, 90 günde medyan getiri +%6.4, isabet oranı %61."

### Risk Officer (Final): "REDUCE_SIZE (Boyutu Azalt). Maksimum pozisyon büyüklüğü: %2.5 NAV. Stop: Brent'in art arda 3 seansta $65 altında kapatması. Tez ilgi çekici ancak sözleşmenin şeffaflık riski gerçek."

### CIO kapanışı yapar: "6 FOR / 1 AGAINST / 2 NEUTRAL. İnanç seviyesi: ORTA. Eylem: %2.5 NAV ile LONG THYAO."

### Adım 7 — Sağ Kenar Çubuğunu Oku ve Karar Ver
Komite tamamlandıktan sonra sağ kenar çubuğunda şunlar belirecektir:
Skorlar:

Edge: 71 (fena olmayan bir fikir)

Risk: 68 (orta düzey risk)

Consensus: 45 (ajanlar hemfikir değil — dikkatli ol)

### Risk Kararı: REDUCE_SIZE (Boyutu Azalt)
Ne Yapılmalı:

Fikri küçültülmüş bir pozisyon boyutuyla onayla

NAV'ın sadece %2.5'ini kullan

Stop-loss zorunlu — o olmadan giriş yapma

Tez doğrulanırsa daha sonra maliyet düşürülebilir (do-average)

Şimdi karar veren sensin. Ajanlar değil. Sen.
Eğer kabul ediyorsan — Onayla (Approve) butonuna bas. Etmiyorsan — Reddet (Reject).

### Neden gerekli: Farklı bakış açılarından yapılandırılmış bir analiz aldın. Boğa (Bull) neden alman gerektiğini söyledi. Ayı (Bear) neden almaman gerektiğini söyledi. Makro bağlamı sağladı. Quant istatistikleri sundu. Risk Officer (Risk Yöneticisi) sana net parametreler verdi. Artık kararını duygularınla değil, bilgiyle veriyorsun.

### Adım 8 — Emri Gerçekleştir
Onayladıktan (Approve) sonra sistem Emir Yürütme (Execution Console) sayfasında bir emir oluşturur.

İlk olarak, sayfanın üst kısmındaki Terminal Modunu EXECUTION olarak değiştir.

Execution sekmesinde THYAO LONG emrini "approved" (onaylandı) durumunda göreceksin. Send (Gönder) butonuna bas — sistem Yahoo Finance'ten güncel fiyatı alır ve veritabanında pozisyonu oluşturur.

### Önemli: BIST için gerçek bir broker bağlantısı yok. "BIST paper-mode" (sanal işlem) uyarısını göreceksin. Bu, emrin sisteme kaydedildiği, ancak hisseyi gerçekten kendi aracı kurum uygulaman (Midas, İş Yatırım vb.) üzerinden satın alman gerektiği anlamına gelir. Sistem pozisyonu takip eder, işlemleri aracı kurumun yapar.

### Adım 9 — Pozisyonu Takip Et
Portföy (Portfolio) sayfasına git. THYAO LONG pozisyonunu güncel fiyatı ve gerçekleşmemiş (unrealized) P&L'i ile göreceksin.

Her gün Refresh Prices butonuna tıkla — sistem Yahoo Finance üzerinden fiyatları güncelleyecek ve P&L hesaplamalarını yenileyecektir.

Risk Cockpit'te şunları görebilirsin:

Sector Concentration (Sektör Yoğunluğu): Enerji %2.5 NAV (normal sınırlar içinde, limit %5)

Positions Without Stop-Loss: Eğer stop koymayı unutursan, sistem kırmızı bir uyarı gösterecektir.

Operations Console sayfasında Run Stop Watcher butonuna tıkla — sistem canlı fiyatlarla tüm stop'ları kontrol edecektir. Eğer THYAO senin belirlediğin stop seviyesinin altına düşerse, sana bir uyarı gelecektir.

### Adım 10 — İşlemi Kapat ve Öğren
Pozisyonu kapattığında (kendi broker'ında manuel olarak), Günlük (Trade Journal) sayfasına git ve Add Trade butonuna bas — giriş/çıkış fiyatlarını ve tarihleri gir.
Run Post-Mortem butonuna tıkla — Gemini tüm komite tartışmasını ve işlemin sonucunu analiz edecektir. Şunları yazacak:

### Ne işe yaradı: "Bear (Ayı), sözleşme şeffaflığı konusunda haklıydı."

### Ne işe yaramadı: "Makro rüzgarları hafife alındı."

### Ders: "Dalgalı (Volatile) rejimde pozisyon boyutunu daha da küçült."
Bu ders, sistemin hafızasına kaydedilir.

### Adım 11 — Hafızayı Kullan
Bir ay sonra Araştırma (Research) sayfasını açıp soruyorsun: "Türk havayolu şirketleri hakkında ne biliyoruz?"
Sistem THYAO ile ilgili daha önce yazdığın notları, ajan tartışmalarını ve post-mortem analizini bulup spesifik belgelere atıfta bulunarak yanıt verir. Sistem her şeyi hatırladığı için aynı hataları tekrarlamazsın.
