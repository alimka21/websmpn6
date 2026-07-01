export interface AiSoalInput {
  soalId: string;
  nomor: number;
  pertanyaan: string;
  tipe: string;
  jawabanSiswa: string;
}

export interface AiSoalResult {
  soalId: string;
  nilai: number;   // 1–10
  alasan: string;
}

export async function nilaiDenganGemini(
  apiKey: string,
  soalList: AiSoalInput[],
): Promise<AiSoalResult[]> {
  const prompt = `Kamu adalah asisten penilai ujian sekolah. Nilai jawaban uraian/esai siswa berikut.

Untuk setiap jawaban, berikan:
- nilai: integer 1-10 (10=sempurna/lengkap, 1=tidak relevan/kosong)
- alasan: 1-2 kalimat singkat dalam Bahasa Indonesia mengapa nilainya segitu

Format output HANYA JSON array (tanpa teks, tanpa markdown):
[{"soalId":"...","nilai":7,"alasan":"..."}]

Data soal dan jawaban siswa:
${JSON.stringify(soalList, null, 2)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `Gemini API error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Bukan array');
    return parsed.map((r: any) => ({
      soalId: String(r.soalId ?? ''),
      nilai: Math.max(1, Math.min(10, Math.round(Number(r.nilai) || 5))),
      alasan: String(r.alasan ?? ''),
    }));
  } catch {
    throw new Error('Gagal membaca respons AI. Coba lagi.');
  }
}
