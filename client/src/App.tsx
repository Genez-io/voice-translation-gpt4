import {
  supportedSourceLanguages,
  supportedTargetLanguages,
} from "./config/supportedLanguage";
import { useState } from "react";

function AudioTranslator() {
  const [sourceLanguage, setSourceLanguage] = useState(
    supportedSourceLanguages[0].code
  );
  const [targetLanguage, setTargetLanguage] = useState(
    supportedTargetLanguages[0].code
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<{
    sourceTranscript: string;
    targetTranscript: string;
    targetAudio: string;
    retranslatedText: string;
    metrics: {
      bleuScore: number;
      rouge1Score: number;
      rougeLScore: number;
    };
  } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
        resolve(base64String.split(",")[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleTranslate = async () => {
    if (!audioFile) return;

    try {
      setIsTranslating(true);

      // Validate audio file type
      const validAudioTypes = [
        "audio/wav",
        "audio/mp3",
        "audio/mpeg",
        "audio/ogg",
      ];
      if (!validAudioTypes.includes(audioFile.type)) {
        throw new Error(
          "Invalid audio format. Please upload a WAV, MP3, or OGG file."
        );
      }

      // Get audio format from mime type (e.g., "audio/wav" -> "wav")
      const audioFormat = audioFile.type.split('/')[1].replace('mpeg', 'mp3');

      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (audioFile.size > maxSize) {
        throw new Error("Audio file is too large. Maximum size is 10MB.");
      }

      const audioBase64 = await convertToBase64(audioFile);

      if (!import.meta.env.VITE_API_URL_FASTAPI) {
        throw new Error("API URL is not set");
      }

      // Validate base64 string
      if (!audioBase64) {
        throw new Error("Failed to convert audio file to base64");
      }

      const response = await fetch(
        import.meta.env.VITE_API_URL_FASTAPI + "/translate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio_base64: audioBase64,
            source_language: sourceLanguage,
            target_language: targetLanguage,
            audio_format: audioFormat,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Translation request failed"
        );
      }

      const data = await response.json();
      setTranslationResult({
        sourceTranscript: data.source_transcript,
        targetTranscript: data.target_transcript,
        targetAudio: data.target_audio,
        retranslatedText: data.retranslated_text,
        metrics: {
          bleuScore: data.metrics.bleu_score,
          rouge1Score: data.metrics.rouge1_score,
          rougeLScore: data.metrics.rougeL_score,
        },
      });
    } catch (error) {
      console.error("Translation failed:", error);
      alert(error instanceof Error ? error.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const Footer = () => (
    <footer className="px-2 py-4 mt-8 text-sm text-center text-gray-500 sm:px-4 sm:mt-18">
      <p>Developed and deployed on Genezio</p>
      <button className="flex items-center gap-2 px-4 py-2 mx-auto mt-2 bg-gray-100 rounded-lg">
        <a
          href="https://genezio.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <span>🤔</span>
          <span>What is Genezio?</span>
        </a>
      </button>
    </footer>
  );

  if (translationResult) {
    return (
      <div className="flex flex-col h-screen p-2 overflow-hidden sm:p-4">
        <div className="flex flex-col items-center justify-between gap-4 p-2 sm:flex-row sm:p-4">
          <a href="/">
            <img src="/genezio.svg" alt="Genezio Logo" className="h-8 sm:h-10" />
          </a>
          <a
            href="https://app.genez.io/start/deploy?repository=https://github.com/Genez-io/voice-translation-gpt4"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-[#6A4ABA] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>
              <img src="/iconRacket.svg" alt="icon" className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            Make your own version
          </a>
        </div>

        <main className="flex flex-col items-center flex-1 w-full max-w-3xl gap-4 p-4 mx-auto overflow-y-auto sm:p-8">
          <h1 className="mt-4 mb-4 text-3xl font-semibold text-center text-black sm:mt-8 sm:mb-8 sm:text-4xl">
            Audio Translator
          </h1>

          <div className="w-full">
            <div className="w-full mb-8">
              <h3 className="block mb-2 text-gray-700">Translated Audio</h3>
              <audio controls className="w-full mb-4">
                <source
                  src={`data:audio/wav;base64,${translationResult.targetAudio}`}
                  type="audio/wav"
                />
              </audio>
            </div>

            <div className="w-full mb-4">
              <label className="block mb-2 text-gray-700">
                Original Transcription
              </label>
              <div className="w-full p-4 bg-white border border-gray-200 rounded-lg">
                {translationResult.sourceTranscript}
              </div>
            </div>

            <div className="w-full mb-4">
              <label className="block mb-2 text-gray-700">
                Translated Text
              </label>
              <div className="w-full p-4 bg-white border border-gray-200 rounded-lg">
                {translationResult.targetTranscript}
              </div>
            </div>

            <div className="flex justify-end w-full mb-4">
              <button
                onClick={() => setTranslationResult(null)}
                className="text-sm italic text-right text-gray-600 transition-all hover:text-gray-800 hover:underline"
              >
                Translate another voice &gt;&gt;
              </button>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-2 overflow-hidden sm:p-4">
      <div className="flex flex-col items-center justify-between gap-4 p-2 sm:flex-row sm:p-4">
        <a href="/">
          <img src="/genezio.svg" alt="Genezio Logo" className="h-8 sm:h-10" />
        </a>
        <a
          href="https://app.genez.io/start/deploy?repository=https://github.com/Genez-io/voice-translation-gpt4"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto bg-[#6A4ABA] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <span>
            <img src="/iconRacket.svg" alt="icon" className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          Make your own version
        </a>
      </div>

      <main className="flex flex-col items-center flex-1 w-full max-w-3xl gap-4 p-4 mx-auto overflow-y-auto sm:p-8">
        <h1 className="mt-4 mb-4 text-3xl font-semibold text-center text-black sm:mt-8 sm:mb-8 sm:text-4xl">
          Audio Translator
        </h1>

        <div className="w-full mb-4">
          <label className="block mb-2 font-medium text-gray-700">
            Upload Audio File
          </label>
          <div className="flex flex-col items-center w-full gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg sm:flex-row">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
              id="audio-upload"
            />
            <label
              htmlFor="audio-upload"
              className="w-full px-4 py-1 text-center text-gray-700 transition-colors bg-gray-100 rounded-full cursor-pointer sm:w-auto hover:bg-gray-200"
            >
              Choose file
            </label>
            {audioFile && (
              <span className="text-sm text-gray-600 truncate">{audioFile.name}</span>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
          <div>
            <label className="block mb-2 font-medium text-gray-700">
              Source Language
            </label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg"
            >
              <option value="" disabled>
                Select language
              </option>
              {supportedSourceLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2 font-medium text-gray-700">
              Target Language
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg"
            >
              <option value="" disabled>
                Select language
              </option>
              {supportedTargetLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleTranslate}
          disabled={!audioFile || isTranslating}
          className="w-full py-3 bg-[#6A4ABA] text-white rounded-lg font-medium text-base flex items-center justify-center gap-2"
        >
          {isTranslating && (
            <svg
              className="w-5 h-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {isTranslating ? "Translating..." : "Translate"}
        </button>
      </main>

      <Footer />
    </div>
  );
}

export default AudioTranslator;
