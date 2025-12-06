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
        print(f"[INFO] Extracted text from image '{os.path.basename(image_path)}'")
        return extracted_text.strip()

    except GoogleAPIError as e:
        print(f"[ERROR] Google Vision API error for image '{os.path.basename(image_path)}': {e.message}")
        return ''
    except Exception as e:
        print(f"[ERROR] Unexpected error processing image '{os.path.basename(image_path)}': {e}")
        return ''

def process_text_with_gpt(text):
    prompt = f"""
I will send several photos showing forms from a dental clinic. Each form contains one or more cell phone numbers, the patient's name, email, date of birth, CPF, and address. The task is to transcribe these details into an XLSX file.

- The patient's name is located on the 'NOME' line in the top left corner of the form.
- The phone number(s) are on the 'TELEFONE:' line in the top right corner of the form.
- The email, if present, is usually near the phone number or under the contact information.
- The date of birth may appear near or below the 'DATA DE NASCIMENTO' label.
- The CPF may be found near the 'CPF' label, often under or near the personal details.
- The address typically follows the 'ENDEREÇO' label.

The formatting in the XLSX file should be as follows:

- The patient's name in the first column.
- The corresponding phone number in the second column.
- The email in the third column.
- The CPF in the fourth column.
- The date of birth in the fifth column.
- The address in the sixth column.

If the form contains more than one phone number, create additional rows for each number, keeping the other details (name, email, CPF, date of birth, and address) the same in the respective columns, and numbering the names as shown below:

**Example:**

| Name  | Phone  | Email        | CPF         | Date of Birth  | Address   |
|-------|--------|--------------|-------------|----------------|-----------|
| Joel  | number1| email@example.com | 123.456.789-00 | 01/01/1990 | 123 Main St |
| Joel  | number2| email@example.com | 123.456.789-00 | 01/01/1990 | 123 Main St |
| Joel  | number3| email@example.com | 123.456.789-00 | 01/01/1990 | 123 Main St |

Ensure that each piece of information is captured correctly and that the formatting in the XLSX file is precise.

**Extracted Text:**
{text}

    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an assistant that extracts and formats data from text."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=16384,
            temperature=0
        )

        formatted_data = response['choices'][0]['message']['content'].strip()
        print(f"[INFO] Successfully processed text with GPT.")
        return formatted_data

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
            if '|' in line and not line.startswith('| Name') and not line.startswith('|-------'):
                parts = line.strip('|').split('|')
                if len(parts) >= 6:
                    name = parts[0].strip()
                    phone = parts[1].strip()
                    email = parts[2].strip() if len(parts) > 2 else ''
                    cpf = parts[3].strip() if len(parts) > 3 else ''
                    date_of_birth = parts[4].strip() if len(parts) > 4 else ''
                    address = parts[5].strip() if len(parts) > 5 else ''
                    data.append({
                        'Name': name,
                        'Phone': phone,
                        'Email': email,
                        'CPF': cpf,
                        'Date of Birth': date_of_birth,
                        'Address': address
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
        sys.exit(f"[ERROR] No image files found in '{upload_dir}'.")

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
            print(f"[WARNING] No valid data parsed from GPT output for image '{os.path.basename(image_path)}'.")
            continue

        all_data.extend(parsed_data)

    if all_data:
        save_to_excel(all_data, output_file)
        return output_file
    else:
        print("[INFO] No data extracted to save.")
        return None
