import os
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from bson.objectid import ObjectId
import requests
import jwt
from clerk_backend_api import Clerk
import uuid

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Add CORS support - critical for frontend to backend communication
CORS(app, origins=["http://localhost:5173"], supports_credentials=True)

# Clerk setup
clerk_api_key = os.getenv("CLERK_API_KEY")
clerk_jwt_key = os.getenv("JWKS_Public_Key")
print(f"Clerk API Key exists: {bool(clerk_api_key)}")
print(f"JWT Key exists: {bool(clerk_jwt_key)}")
model_name = os.getenv("HUGGINGFACE_MODEL_REPO_ID", "deepseek/deepseek-v3-0324")
api_key = os.getenv("HUGGINGFACE_API_KEY")
hf_space_url = os.getenv("HF_SPACE_URL")

# Initialize Clerk client
try:
    clerk_client = Clerk(clerk_api_key)
    print("✅ Clerk client initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize Clerk client: {str(e)}")
    clerk_client = None

# Custom function to verify JWT tokens
def verify_token(token, jwt_key):
    try:
        decoded = jwt.decode(
            token,
            jwt_key,
            algorithms=["HS256", "RS256"],
            options={"verify_signature": True}
        )
        return decoded
    except jwt.ExpiredSignatureError:
        raise Exception("Token has expired")
    except jwt.InvalidTokenError as e:
        raise Exception(f"Invalid token: {str(e)}")

# MongoDB setup with error handling
try:
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
    mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    mongo_client.admin.command('ping')
    print("✅ Connected to MongoDB successfully")
    
    db = mongo_client.get_database("chat_app_db")
    conversations_collection = db.conversations
    users_collection = db.users
    
    # Create indexes
    conversations_collection.create_index([("user_id", 1)])
    conversations_collection.create_index([("conversation_id", 1)], unique=True)
    users_collection.create_index([("user_id", 1)], unique=True)
except ConnectionFailure:
    print("❌ Failed to connect to MongoDB. Please check if MongoDB is running.")
except Exception as e:
    print(f"❌ MongoDB setup error: {str(e)}")

# Hugging Face configs
model_name = os.getenv("HUGGINGFACE_MODEL_REPO_ID", "google/flan-t5-small")
hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
hf_space_url = os.getenv("HF_SPACE_URL")

# Middleware to verify Clerk JWT and check user in DB
def require_auth(f):
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ")[1]
        try:
            claims = verify_token(token, clerk_jwt_key)
            user_id = claims["sub"]
            print(user_id)
            request.user_id = user_id
            
            # Check if user exists in DB, if not create one
            try:
                existing_user = users_collection.find_one({"id": user_id})
                if not existing_user:
                    if not clerk_client:
                        raise Exception("Clerk client not initialized")
                    
                    # Fetch user details from Clerk
                    try:
                        clerk_user = clerk_client.users.get(user_id)
                        users_collection.insert_one({
                            "id": user_id,
                            "email": clerk_user.email_addresses[0].email_address if clerk_user.email_addresses else None,
                            "name": clerk_user.fullName,
                            "created_at": datetime.now(timezone.utc),
                            "last_active": datetime.now(timezone.utc)
                        })
                        print(f"✅ Created user {user_id} in database")
                    except Exception as e:
                        print(f"❌ Failed to fetch user from Clerk: {str(e)}")
                        raise Exception(f"Clerk API error: {str(e)}")
                else:
                    # Update last active timestamp
                    users_collection.update_one(
                        {"user_id": user_id},
                        {"$set": {"last_active": datetime.now(timezone.utc)}}
                    )
            except Exception as e:
                print(f"❌ User database operation failed: {str(e)}")
                return jsonify({"error": "Failed to process user data", "details": str(e)}), 500
                
        except Exception as e:
            print(f"❌ Token verification failed: {str(e)}")
            return jsonify({"error": "Invalid or expired token", "details": str(e)}), 401

        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

@app.route('/api/save-user', methods=["POST"])
@require_auth
def save_user():
    try:
        user_data = request.get_json()
        if not user_data:
            return jsonify({"error": "Missing user data"}), 400
        
        clerk_id = user_data.get(("clerkid"))
        email = user_data.get("email")
        first_name = user_data.get("name")

        if not email:
            return jsonify({"error": "Email is required"}), 400

        existing_user = users_collection.find_one({"email": email})

        now = datetime.now(timezone.utc)
        if existing_user:
            users_collection.update_one(
                {"user_id": clerk_id},
                {
                    "$set": {
                        "email": email,
                        "name": first_name,
                        "last_active": now,
                        "last_updated": now
                    }
                }
            )
            return jsonify({"message": "User updated successfully", "user_id": clerk_id}), 200
        else:
            users_collection.insert_one({
                "clerk_id" : clerk_id,
                "email": email,
                "name": first_name,
                "created_at": now,
                "last_active": now
            })
            return jsonify({"message": "User created successfully", "user_id": clerk_id}), 201

    except Exception as e:
        print(f"Error in save_user: {str(e)}")
        return jsonify({"error": "Failed to save user", "details": str(e)}), 500

def call_huggingface_chat_model(message):
    if not api_key:
        raise ValueError("HuggingFace API key is not configured")
    
    try:
        API_URL = "https://router.huggingface.co/novita/v3/openai/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": message
                }
            ],
            "model": f"{model_name}"
        }
        
        response = requests.post(API_URL, headers=headers, json=payload)
        return response.json()["choices"][0]["message"]["content"]
        
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"Response content: {e.response.text}")
        raise
    
    

@app.route('/api/save-convo', methods=['POST'])
@require_auth
def save_conversation():
    try:
        data = request.get_json()
        user_id = request.user_id  # From the auth middleware
        conversation_id = data.get("conversationId")
        title = data.get("title", "Untitled Conversation")
        messages = data.get("messages", [])

        if not conversation_id:
            return jsonify({"error": "conversationId is required"}), 400
        
        # Prepare update document
        update_doc = {
            "user_id": user_id,
            "title": title,
            "messages": messages,
            "updated_at": datetime.utcnow()
        }

        # Check if conversation exists
        existing = conversations_collection.find_one({"conversation_id": conversation_id, "user_id": user_id})
        if existing:
            # Update existing
            conversations_collection.update_one(
                {"conversation_id": conversation_id, "user_id": user_id},
                {"$set": update_doc}
            )
        else:
            # Insert new conversation with created_at
            update_doc["conversation_id"] = conversation_id
            update_doc["created_at"] = datetime.utcnow()
            conversations_collection.insert_one(update_doc)

        return jsonify({"conversationId": conversation_id}), 200
    except Exception as e:
        print(f"Error saving conversation: {str(e)}")
        return jsonify({"error": str(e)}), 500


#calling model from huggingface
@app.route("/chat", methods=["POST"])
def chat():
    """Handle user messages and return model responses."""
    data = request.get_json()
    inputs = data.get("inputs")
    conversation_id = data.get("conversation_id")
    is_temp = data.get("is_temp", True)

    try:
        response_text = call_huggingface_chat_model(inputs)
    except Exception as e:
        return jsonify({"error": "Model inference failed", "details": str(e)}), 500

    # Save to MongoDB if not a temporary conversation
    if not is_temp:
        if not conversation_id:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            new_conversation = {
                "conversation_id": conversation_id,
                "title": inputs[:50],  # Truncate for title
                "messages": [
                    {"sender": "user", "text": inputs},
                    {"sender": "bot", "text": response_text}
                ],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            conversations_collection.insert_one(new_conversation)
        else:
            # Update existing conversation
            conversations_collection.update_one(
                {"conversation_id": conversation_id},
                {
                    "$push": {
                        "messages": {
                            "$each": [
                                {"sender": "user", "text": inputs},
                                {"sender": "bot", "text": response_text}
                            ]
                        }
                    },
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
        
        return jsonify({
            "response": response_text,
            "conversation_id": conversation_id
        })
    else:
        return jsonify({"response": response_text})


if __name__ == "__main__":
    os.environ["DEBUG"] = "1"
    app.run(debug=True)