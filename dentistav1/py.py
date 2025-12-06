import os
import sys
import pandas as pd
import openai
from google.cloud import vision
from google.api_core.exceptions import GoogleAPIError
from tqdm import tqdm

# Load OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    sys.exit("Error: OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")

openai.api_key = OPENAI_API_KEY

# Verify Google Cloud Vision credentials
GOOGLE_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
if not GOOGLE_CREDENTIALS or not os.path.isfile(GOOGLE_CREDENTIALS):
    sys.exit("Error: Google Cloud Vision API credentials not found. Please set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of your credentials JSON file.")

def extract_text_from_image(image_path):
    client = vision.ImageAnnotatorClient()
    try:
        with open(image_path, 'rb') as image_file:
            content = image_file.read()
        image = vision.Image(content=content)
        response = client.text_detection(image=image)
        if response.error.message:
            raise GoogleAPIError(response.error.message)
        texts = response.text_annotations
        extracted_text = texts[0].description if texts else ''
        return extracted_text.strip()
    except GoogleAPIError as e:
        print(f"[ERROR] Google Vision API error: {e.message}")
        return ''
    except Exception as e:
        print(f"[ERROR] Unexpected error processing image '{image_path}': {e}")
        return ''

def process_text_with_gpt(text):
    prompt = f"""
Process the following text extracted from a dental form and format it into structured data:

{text}
"""
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI that extracts and formats data from dental records."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0
        )
        return response['choices'][0]['message']['content'].strip()
    except openai.OpenAIError as e:
        print(f"[ERROR] OpenAI API error: {e}")
        return ''
    except Exception as e:
        print(f"[ERROR] Unexpected error processing text with GPT: {e}")
        return ''

def parse_gpt_output(gpt_output):
    try:
        lines = gpt_output.split('\n')
        data = []
        for line in lines:
            parts = [p.strip() for p in line.strip('|').split('|') if p.strip()]
            if len(parts) >= 6:
                data.append({
                    'Name': parts[0],
                    'Phone': parts[1],
                    'Email': parts[2],
                    'CPF': parts[3],
                    'Date of Birth': parts[4],
                    'Address': parts[5]
                })
        return data
    except Exception as e:
        print(f"[ERROR] Error parsing GPT output: {e}")
        return []

def save_to_excel(data, file_path):
    try:
        df = pd.DataFrame(data)
        df.to_excel(file_path, index=False)
        print(f"[INFO] Excel file saved at '{file_path}'")
    except Exception as e:
        print(f"[ERROR] Error saving Excel file: {e}")

def process_uploaded_files(upload_dir, custom_prompt, output_file):
    image_files = [
        os.path.join(upload_dir, f)
        for f in os.listdir(upload_dir)
        if f.lower().endswith((".jpg", ".png", ".jpeg", ".tiff"))
    ]
    if not image_files:
        print(f"[ERROR] No image files found in '{upload_dir}'.")
        return None
    
    all_data = []
    for image_path in tqdm(image_files, desc="Processing images"):
        extracted_text = extract_text_from_image(image_path)
        if not extracted_text:
            continue
        gpt_output = process_text_with_gpt(extracted_text)
        if not gpt_output:
            continue
        parsed_data = parse_gpt_output(gpt_output)
        if not parsed_data:
            print(f"[WARNING] No valid data parsed from GPT output for '{image_path}'")
            continue
        all_data.extend(parsed_data)
    
    if all_data:
        save_to_excel(all_data, output_file)
        return output_file
    else:
        print("[INFO] No data extracted to save.")
        return None
