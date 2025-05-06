import requests
import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from functools import wraps

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for requests from the frontend

# Configure models
model_name = os.getenv("HUGGINGFACE_MODEL_REPO_ID", "google/flan-t5-small")
api_key = os.getenv("HUGGINGFACE_API_KEY")

# Configure MongoDB
mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
mongo_client = MongoClient(mongo_uri)
db = mongo_client.get_database("conversation_history")
conversations_collection = db.conversations

# Configure Clerk
clerk_api_key = os.getenv("CLERK_SECRET_KEY")

if not model_name or not api_key:
    print("❌ Error: HUGGINGFACE_MODEL_REPO_ID or HUGGINGFACE_API_KEY not found in .env file.")
else:
    print(f"✅ Using Model: {model_name}")

if not mongo_uri:
    print("❌ Error: MONGODB_URI not found in .env file. Using default local connection.")
else:
    print("✅ MongoDB connection configured")

if not clerk_api_key:
    print("❌ Warning: CLERK_SECRET_KEY not found in .env file. Authentication validation will be limited.")
else:
    print("✅ Clerk API key configured")

API_URL = f"https://api-inference.huggingface.co/models/{model_name}"
headers = {"Authorization": f"Bearer {api_key}"}

# Fallback model in case the primary model is not available
FALLBACK_MODEL = "facebook/bart-large-cnn"
FALLBACK_API_URL = f"https://api-inference.huggingface.co/models/{FALLBACK_MODEL}"

# Authentication middleware
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authentication required"}), 401
        
        # Extract the token
        token = auth_header.split(' ')[1]
        
        # Verify with Clerk - in a production app, you'd use clerk-sdk to validate
        # For now, we'll accept the token and extract the user ID from it
        # This is a simplified approach - in production use proper Clerk SDK validation
        try:
            # In a real implementation, you would use clerk-sdk to validate the token
            # and get the user ID, this is a placeholder
            user_id = request.headers.get('X-User-ID')  # Frontend should pass this header
            
            if not user_id:
                return jsonify({"error": "Invalid authentication"}), 401
                
            # Add user_id to request context
            request.user_id = user_id
            return f(*args, **kwargs)
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return jsonify({"error": "Invalid authentication"}), 401
            
    return decorated_function

@app.route('/chat', methods=['POST'])
def chat():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    user_input = data.get('inputs')
    conversation_id = data.get('conversationId')
    is_temp = data.get('isTemp', True)  # Default to temporary conversation
    user_id = data.get('userId')  # Optional for temp conversations

    if not user_input:
        return jsonify({"error": "Missing 'inputs' field in request"}), 400

    # Create a simple fallback response in case all models fail
    fallback_text = f"I received your message: {user_input}. However, I'm currently having trouble connecting to my language model. Please try again later."

    # Different models might expect different payload formats
    # T5 and BART style models
    general_payload = {
        "inputs": user_input,
        "parameters": {"max_new_tokens": 150, "return_full_text": False}
    }

    try:
        # Try the primary model first
        print(f"🔄 Trying primary model: {model_name}")
        try:
            response = requests.post(API_URL, headers=headers, json=general_payload, timeout=10)
            response.raise_for_status()
            print(f"✅ Primary model response received: {response.status_code}")
            model_used = model_name
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Primary model failed: {e}, trying fallback model")
            # If primary model fails, try the fallback model
            try:
                response = requests.post(FALLBACK_API_URL, headers=headers, json=general_payload, timeout=10)
                response.raise_for_status()
                print(f"✅ Fallback model response received: {response.status_code}")
                model_used = FALLBACK_MODEL
            except requests.exceptions.RequestException as e:
                print(f"❌ All models failed: {e}, using local fallback")
                # If all models fail, use a locally generated response
                bot_response = fallback_text
                
                # Store conversation if needed and return
                if not is_temp and user_id:
                    timestamp = datetime.utcnow()
                    
                    if not conversation_id:
                        conversation_id = str(timestamp.timestamp())
                        conversations_collection.insert_one({
                            "conversation_id": conversation_id,
                            "user_id": user_id,
                            "created_at": timestamp,
                            "updated_at": timestamp,
                            "messages": [
                                {"role": "user", "content": user_input, "timestamp": timestamp},
                                {"role": "assistant", "content": bot_response, "timestamp": timestamp}
                            ]
                        })
                    else:
                        conversations_collection.update_one(
                            {"conversation_id": conversation_id, "user_id": user_id},
                            {
                                "$push": {
                                    "messages": {
                                        "$each": [
                                            {"role": "user", "content": user_input, "timestamp": timestamp},
                                            {"role": "assistant", "content": bot_response, "timestamp": timestamp}
                                        ]
                                    }
                                },
                                "$set": {"updated_at": timestamp}
                            }
                        )
                
                return jsonify({
                    "response": bot_response,
                    "conversationId": conversation_id if not is_temp else None
                })

        # Try to parse the JSON response from Hugging Face
        try:
            print(f"🔄 Parsing response from {model_used}")
            hf_response = response.json()
            
            # Handle different response formats based on the model
            if isinstance(hf_response, list) and len(hf_response) > 0:
                if 'generated_text' in hf_response[0]:
                    # Standard format for many models
                    bot_response = hf_response[0]['generated_text']
                elif 'summary_text' in hf_response[0]:
                    # Format for some summarization models
                    bot_response = hf_response[0]['summary_text']
                else:
                    # Unknown format but we have some text in the first item
                    bot_response = str(hf_response[0])
            elif isinstance(hf_response, dict):
                if 'generated_text' in hf_response:
                    bot_response = hf_response['generated_text']
                else:
                    # Unknown dictionary format
                    bot_response = str(hf_response)
            else:
                # Fallback for any other structure
                print(f"⚠️ Unexpected Hugging Face response structure: {hf_response}")
                bot_response = "I received your message, but I'm having trouble formulating a response right now."
            
            print(f"✅ Successfully parsed response")

            # Store conversation message if not temporary
            if not is_temp and user_id:
                timestamp = datetime.utcnow()
                
                # If conversation_id is not provided, create a new conversation
                if not conversation_id:
                    conversation_id = str(timestamp.timestamp())
                    
                    # Create a new conversation document
                    conversations_collection.insert_one({
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "created_at": timestamp,
                        "updated_at": timestamp,
                        "messages": [
                            {"role": "user", "content": user_input, "timestamp": timestamp},
                            {"role": "assistant", "content": bot_response, "timestamp": timestamp}
                        ]
                    })
                else:
                    # Update existing conversation
                    conversations_collection.update_one(
                        {"conversation_id": conversation_id, "user_id": user_id},
                        {
                            "$push": {
                                "messages": {
                                    "$each": [
                                        {"role": "user", "content": user_input, "timestamp": timestamp},
                                        {"role": "assistant", "content": bot_response, "timestamp": timestamp}
                                    ]
                                }
                            },
                            "$set": {"updated_at": timestamp}
                        }
                    )

            return jsonify({
                "response": bot_response,
                "conversationId": conversation_id if not is_temp else None
            })

        except ValueError as e:
            # Handle case where the response might not be JSON
            print(f"⚠️ Non-JSON response: {e}")
            if response.text:
                # If there's text in the response, use it directly
                bot_response = response.text.strip()
            else:
                bot_response = fallback_text
                
            # Store conversation message if not temporary
            if not is_temp and user_id:
                timestamp = datetime.utcnow()
                
                if not conversation_id:
                    conversation_id = str(timestamp.timestamp())
                    conversations_collection.insert_one({
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "created_at": timestamp,
                        "updated_at": timestamp,
                        "messages": [
                            {"role": "user", "content": user_input, "timestamp": timestamp},
                            {"role": "assistant", "content": bot_response, "timestamp": timestamp}
                        ]
                    })
                else:
                    conversations_collection.update_one(
                        {"conversation_id": conversation_id, "user_id": user_id},
                        {
                            "$push": {
                                "messages": {
                                    "$each": [
                                        {"role": "user", "content": user_input, "timestamp": timestamp},
                                        {"role": "assistant", "content": bot_response, "timestamp": timestamp}
                                    ]
                                }
                            },
                            "$set": {"updated_at": timestamp}
                        }
                    )
                
            return jsonify({
                "response": bot_response,
                "conversationId": conversation_id if not is_temp else None
            })
        except Exception as e:
            print(f"❌ Failed to parse response: {e}")
            return jsonify({"error": "Failed to process model response"}), 502  # Bad Gateway

    except Exception as e:
        print(f"❌ Unexpected error in chat endpoint: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500  # Internal Server Error

@app.route('/conversations', methods=['GET'])
@require_auth
def get_conversations():
    user_id = request.user_id
    
    # Fetch all conversations for this user with message content
    conversations = list(conversations_collection.find(
        {"user_id": user_id},
        {"_id": 0, "conversation_id": 1, "created_at": 1, "updated_at": 1, "messages": 1}
    ).sort("updated_at", -1))
    
    # Convert datetime objects to strings
    for conv in conversations:
        if "created_at" in conv:
            conv["created_at"] = conv["created_at"].isoformat()
        if "updated_at" in conv:
            conv["updated_at"] = conv["updated_at"].isoformat()
        # Convert message timestamps if present
        if "messages" in conv:
            for message in conv["messages"]:
                if "timestamp" in message:
                    message["timestamp"] = message["timestamp"].isoformat()
    
    return jsonify(conversations)

@app.route('/conversations/<conversation_id>', methods=['GET'])
@require_auth
def get_conversation(conversation_id):
    user_id = request.user_id
    
    # Fetch specific conversation
    conversation = conversations_collection.find_one(
        {"conversation_id": conversation_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    # Convert datetime objects to strings
    if "created_at" in conversation:
        conversation["created_at"] = conversation["created_at"].isoformat()
    if "updated_at" in conversation:
        conversation["updated_at"] = conversation["updated_at"].isoformat()
    
    if "messages" in conversation:
        for message in conversation["messages"]:
            if "timestamp" in message:
                message["timestamp"] = message["timestamp"].isoformat()
    
    return jsonify(conversation)

@app.route('/conversations/<conversation_id>', methods=['DELETE'])
@require_auth
def delete_conversation(conversation_id):
    user_id = request.user_id
    
    result = conversations_collection.delete_one({"conversation_id": conversation_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        return jsonify({"error": "Conversation not found"}), 404
    
    return jsonify({"success": True})

if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network if needed, otherwise 127.0.0.1
    app.run(host='0.0.0.0', port=5000, debug=True) # Use a different port if 5000 is taken
