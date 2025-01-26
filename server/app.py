from fastapi import FastAPI, Request
import requests 
import os
import json
import sacrebleu
from rouge_score import rouge_scorer

app = FastAPI()

# Load the API key from the environment variable
api_key = os.getenv("OPENAI_API_KEY")

def process_audio_with_gpt_4o(base64_encoded_audio, output_modalities, system_prompt, audio_format="wav"):
    # Chat Completions API end point 
    url = "https://api.openai.com/v1/chat/completions"

    # Set the headers
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    # Construct the request data
    data = {
        "model": "gpt-4o-audio-preview",
        "modalities": output_modalities,
        "audio": {
            "voice": "alloy",
            "format": audio_format
        },
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": base64_encoded_audio,
                            "format": audio_format
                        }
                    }
                ]
            }
        ]
    }
    
    request_response = requests.post(url, headers=headers, data=json.dumps(data))
    if request_response.status_code == 200:
        return request_response.json()
    else:  
        print(f"Error {request_response.status_code}: {request_response.text}")
        return

@app.post("/translate")
async def translate_audio(request: Request):
    body = await request.json()
    audio_base64 = body.get("audio")
    source_language = body.get("source_language", "English")
    target_language = body.get("target_language", "Hindi")
    audio_format = body.get("audio_format", "wav")
    
    # First transcription to source language
    modalities = ["text"]
    prompt = f"The user will provide an audio file in {source_language}. Transcribe the audio to {source_language} text, word for word. Only provide the language transcription, do not include background noises such as applause."
    
    response_json = process_audio_with_gpt_4o(audio_base64, modalities, prompt, audio_format)
    source_transcript = response_json['choices'][0]['message']['content']
    
    # Translation to target language
    glossary_of_terms_to_keep_in_original_language = "Turbo, OpenAI, token, GPT, Dall-e, Python"
    modalities = ["text", "audio"]
    prompt = f"The user will provide an audio file in {source_language}. Dub the complete audio, word for word in {target_language}. Keep certain words in {source_language} for which a direct translation in {target_language} does not exist such as ${glossary_of_terms_to_keep_in_original_language}."
    
    response_json = process_audio_with_gpt_4o(audio_base64, modalities, prompt, audio_format)
    message = response_json['choices'][0]['message']
    
    target_transcript = message['audio']['transcript']
    target_audio_base64 = message['audio']['data']
    
    # Validation translation back to source language
    modalities = ["text"]
    prompt = f"The user will provide an audio file in {target_language}. Transcribe the audio to {source_language} text word for word. Only provide the language transcription, do not include background noises such as applause."
    
    response_json = process_audio_with_gpt_4o(target_audio_base64, modalities, prompt, audio_format)
    retranslated_text = response_json['choices'][0]['message']['content']
    
    # Calculate metrics
    bleu = sacrebleu.corpus_bleu([retranslated_text], [[source_transcript]])
    scorer = rouge_scorer.RougeScorer(['rouge1', 'rougeL'], use_stemmer=True)
    scores = scorer.score(source_transcript, retranslated_text)
    
    return {
        "source_transcript": source_transcript,
        "target_transcript": target_transcript,
        "target_audio": target_audio_base64,
        "retranslated_text": retranslated_text,
        "metrics": {
            "bleu_score": bleu.score,
            "rouge1_score": scores['rouge1'].fmeasure,
            "rougeL_score": scores['rougeL'].fmeasure
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app)