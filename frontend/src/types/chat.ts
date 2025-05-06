export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Conversation {
  conversation_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}
