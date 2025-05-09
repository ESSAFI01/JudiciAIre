import requests
import os
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from bson.objectid import ObjectId

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

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    inputs = data.get("inputs")
    conversation_id = data.get("conversationId")
    is_temp = data.get("isTemp", True)
    
    # Placeholder for actual chat processing logic
    response_text = f"AI response to: {inputs}"
    
    if not is_temp:
        # Save to DB if not temporary
        if not conversation_id:
            conversation_id = str(ObjectId())
            conversations_collection.insert_one({
                "conversation_id": conversation_id,
                "title": inputs[:50], # Or generate a title
                "messages": [{"role": "user", "content": inputs}, {"role": "assistant", "content": response_text}],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            })
        else:
            conversations_collection.update_one(
                {"conversation_id": conversation_id},
                {
                    "$push": {"messages": {"$each": [{"role": "user", "content": inputs}, {"role": "assistant", "content": response_text}]}},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
        return jsonify({"response": response_text, "conversationId": conversation_id})
    else:
        # Temporary chat
        return jsonify({"response": response_text})

@app.route("/conversations", methods=["GET"])
def get_conversations():
    user_conversations = conversations_collection.find().sort("updated_at", -1)
    # Convert MongoDB documents to a list of dicts, handling ObjectId
    result = []
    for conv in user_conversations:
        conv["_id"] = str(conv["_id"]) # Convert ObjectId to string for JSON serialization
        result.append(conv)
    return jsonify(result)

@app.route("/conversations/<conversation_id_param>", methods=["GET"])
def get_conversation(conversation_id_param):
    conversation = conversations_collection.find_one({"conversation_id": conversation_id_param})
    if conversation:
        conversation["_id"] = str(conversation["_id"]) # Convert ObjectId
        return jsonify(conversation)
    return jsonify({"error": "Conversation not found"}), 404

@app.route("/conversations/<conversation_id_param>", methods=["DELETE"])
def delete_conversation(conversation_id_param):
    result = conversations_collection.delete_one({"conversation_id": conversation_id_param})
    if result.deleted_count > 0:
        return jsonify({"success": True})
    return jsonify({"error": "Conversation not found"}), 404

@app.route('/conversations/<conversation_id_param>', methods=['PATCH'])
def rename_conversation(conversation_id_param):
    data = request.get_json()
    new_title = data.get("title")

    if not new_title:
        return jsonify({"error": "Title is required"}), 400

    result = conversations_collection.update_one(
        {"conversation_id": conversation_id_param},
        {"$set": {"title": new_title}}
    )

    if result.matched_count == 0:
        return jsonify({"error": "Conversation not found"}), 404

    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True)