import requests
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for requests from the frontend

model_name = os.getenv("HUGGINGFACE_MODEL_REPO_ID")
api_key = os.getenv("HUGGINGFACE_API_KEY")

if not model_name or not api_key:
    print("❌ Error: HUGGINGFACE_MODEL_REPO_ID or HUGGINGFACE_API_KEY not found in .env file.")
    # You might want to exit or raise an error here in a real application
else:
    print(f"✅ Using Model: {model_name}")

API_URL = f"https://api-inference.huggingface.co/models/{model_name}"
headers = {"Authorization": f"Bearer {api_key}"}

@app.route('/chat', methods=['POST'])
def chat():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    user_input = data.get('inputs')

    if not user_input:
        return jsonify({"error": "Missing 'inputs' field in request"}), 400

    payload = {
        "inputs": user_input,
        "parameters": {"max_new_tokens": 150, "return_full_text": False} # Adjust parameters as needed
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)

        # Try to parse the JSON response from Hugging Face
        try:
            hf_response = response.json()
            # Assuming the response is a list and we need the 'generated_text' from the first item
            # Adjust this based on the actual structure of your model's response
            if isinstance(hf_response, list) and len(hf_response) > 0 and 'generated_text' in hf_response[0]:
                 bot_response = hf_response[0]['generated_text']
            else:
                 # Fallback or different handling if the structure is unexpected
                 print(f"⚠️ Unexpected Hugging Face response structure: {hf_response}")
                 bot_response = "Sorry, I received an unexpected response format."

            return jsonify({"response": bot_response})

        except requests.exceptions.JSONDecodeError:
            print(f"❌ Failed to parse JSON response from Hugging Face. Status: {response.status_code}, Text: {response.text}")
            return jsonify({"error": "Failed to decode response from AI service"}), 502 # Bad Gateway

    except requests.exceptions.RequestException as e:
        print(f"❌ Error contacting Hugging Face API: {e}")
        return jsonify({"error": f"Failed to contact AI service: {e}"}), 503 # Service Unavailable

if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network if needed, otherwise 127.0.0.1
    app.run(host='0.0.0.0', port=5000, debug=True) # Use a different port if 5000 is taken
