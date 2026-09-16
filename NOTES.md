# Quantessa — Pemetaan Model AI (Roadmap Reference)

> Snapshot harga dari OpenRouter /api/v1/models, 16 Sep 2026.
> Harga bisa berubah; verifikasi final di https://openrouter.ai/models.

## A. Analisis · Teks · Ide/Konsep · Riset (Reasoning LLM)
Input/output dalam $ per 1M token.

| Kategori | Model | Input $/M | Output $/M | Konteks |
|---|---|---|---|---|
| Paling pintar | `anthropic/claude-opus-4.8` | 5.00 | 25.00 | 1M |
| Riset & analisis | `anthropic/claude-sonnet-4.6` | 3.00 | 15.00 | 1M |
| Riset deep | `google/gemini-3.1-pro-preview` | 2.00 | 12.00 | 1M |
| **Default Quantessa** | **`openai/gpt-5-mini`** | 0.25 | 2.00 | 400k |
| Efisien & pintar | `google/gemini-3.1-flash-lite` | 0.25 | 1.50 | 1M |
| Output paling murah | `openai/gpt-4.1-mini` | 0.40 | 1.60 | 1M |
| Ultra-murah (teks) | `deepseek/deepseek-v4-flash` | 0.089 | 0.177 | 1M |
| Premium-sehat | `openai/gpt-5.6-luna` | 0.20 | 1.20 | 1M |

## B. Generate Image (OpenRouter)
Aproksimasi per gambar ≈ `image_output × 1024` (billing unit per-token; verifikasi per model).

| Kategori | Model | ~$/gambar | Catatan |
|---|---|---|---|
| Paling pintar | `google/gemini-3-pro-image` | ~0.12 | Fotorealistik, ikuti instruksi |
| Seimbang | `openai/gpt-5-image` | ~0.04 | Teks/detail dalam gambar |
| Paling efisien | `openai/gpt-5-image-mini` | ~0.008 | Aset kecil, produksi massal |
| Efisien #2 | `openai/gpt-5.4-image-2` | ~0.03 | Cepat |
| Murah & serba guna | `google/gemini-3.1-flash-image` | ~0.06 | Input teks+gambar |

## C. Generate Video (Eksternal — belum di OpenRouter)
| Kategori | Vendor / Produk | Model harga |
|---|---|---|
| Paling pintar | Google Veo 3 (Gemini API / AI Studio) | Per detik & resolusi |
| Kompetitor kuat | Sora 2 · Runway Gen-4 | Per generasi / detik |
| Paling efisien | Kling 2.x lite · Hailuo · Pika | Per generasi (kredit paket) |

## D. Generate 3D Render (Eksternal — belum di OpenRouter)
| Kategori | Vendor / Produk | Model harga |
|---|---|---|
| Paling pintar & efisien | Tripo AI (Tripo 2.x) | Per aset / kredit |
| Sculpt-grade | Meshy (Meshy-4) | Per aset / kredit |
| Karakter/organik | Rodin · Hyper3D | Per aset / kredit |

## E. Lain-lain
| Fungsi | Model | Harga |
|---|---|---|
| TTS / suara realtime | `openai/gpt-audio` | audio_out $0.064/M unit |
| TTS murah | `openai/gpt-audio-mini` | audio_out $0.0024/M unit |
| Musik | `google/lyria-3-pro-preview` | Gratis (preview) |
| Web search (riber) | tool `web_search` model mana pun | $0.014/sesi |

## Jalur Adopsi
1. **Sekarang — teks:** `openai/gpt-5-mini` untuk analisis/riset/drafting per divisi.
2. **Flow konten (nanti):** image gen `gpt-5.4-image-2` (rutin) · `gemini-3-pro-image` (hero/marketing).
3. **Video & 3D (nanti):** vendor eksternal (Veo / Tripo), keputusan saat use case berjalan.