/**
 * A faster first step for the speech model (private mode), with the very same result.
 *
 * Whisper models read 30 seconds of sound at a time: a phrase of 3 seconds is padded with 27 seconds of
 * silence, and the first step (turning the sound into the model's features, a spectrogram) worked
 * through all of it, about a third of each check. Silence always comes out as the same value, so the
 * features are worked out for the part with sound only, and the rest is filled in with that value.
 */
import type { AutomaticSpeechRecognitionPipeline, Tensor } from "@huggingface/transformers";

type FeatureExtractor = {
  config: { hop_length: number; n_fft: number; nb_max_frames: number };
  _extract_fbank_features(waveform: Float32Array): Promise<Tensor>;
};

/** Makes a speech pipeline's first step skip the silence it's padded with. */
export function skipPaddedSilence(asr: AutomaticSpeechRecognitionPipeline) {
  const fe = (asr.processor as unknown as { feature_extractor?: FeatureExtractor }).feature_extractor;
  if (!fe?._extract_fbank_features || !fe.config?.hop_length) return;
  const full = fe._extract_fbank_features.bind(fe);
  const { hop_length: hop, n_fft: nFft, nb_max_frames: frames } = fe.config;
  fe._extract_fbank_features = async (waveform: Float32Array) => {
    // Where the sound ends (the rest is the zeros it was padded with).
    let end = waveform.length;
    while (end > 0 && waveform[end - 1] === 0) end--;
    // Enough after it that every frame touching the sound is worked out exactly as before.
    const keep = Math.ceil((end + 2 * nFft) / hop) * hop;
    if (end === 0 || keep >= waveform.length) return full(waveform);
    const part = await full(waveform.subarray(0, keep));
    const [mels, n] = part.dims as [number, number];
    if (n >= frames) return full(waveform);
    const data = part.data as Float32Array;
    // The features are (max(log10 x, top − 8) + 4) / 4, with top the loudest; silence is log10 of 1e-10.
    let largest = -Infinity;
    for (let i = 0; i < data.length; i++) if (data[i] > largest) largest = data[i];
    const top = 4 * largest - 4;
    const silence = (Math.max(-10, top - 8) + 4) / 4;
    const out = new Float32Array(mels * frames).fill(silence);
    for (let m = 0; m < mels; m++) out.set(data.subarray(m * n, m * n + n), m * frames);
    // (The library's own kind of tensor, whichever copy of the library made it.)
    const Made = part.constructor as new (type: string, data: Float32Array, dims: number[]) => Tensor;
    return new Made("float32", out, [mels, frames]);
  };
}
