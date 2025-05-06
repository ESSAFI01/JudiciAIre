import axios from "axios";
import { Message, Conversation } from "../types/chat";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_URL,
});

export const setAuthToken = (token: string) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export const setUserId = (userId: string) => {
  if (userId) {
    api.defaults.headers.common["X-User-ID"] = userId;
  } else {
    delete api.defaults.headers.common["X-User-ID"];
  }
};

export const chatService = {
  sendMessage: async (
    input: string,
    conversationId?: string,
    isTemp: boolean = true,
    userId?: string
  ) => {
    const response = await api.post("/chat", {
      inputs: input,
      conversationId: conversationId,
      isTemp: isTemp,
      userId: userId,
    });
    return response.data;
  },

  getConversations: async () => {
    const response = await api.get("/conversations");
    return response.data as Conversation[];
  },

  getConversation: async (conversationId: string) => {
    const response = await api.get(`/conversations/${conversationId}`);
    return response.data as Conversation;
  },

  deleteConversation: async (conversationId: string) => {
    const response = await api.delete(`/conversations/${conversationId}`);
    return response.data;
  },
};

export default chatService;
