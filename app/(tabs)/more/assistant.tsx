import React, { useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { brainQuery } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your AI assistant. Ask me anything about your business — customers, jobs, revenue, or operations.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result: any = await brainQuery(userMessage.content);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer || result.data?.answer || result.message || "I couldn't find an answer to that.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, I encountered an error: ${err.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => (
          <View
            className={`mb-3 max-w-[85%] ${
              item.role === "user" ? "self-end" : "self-start"
            }`}
          >
            {item.role === "assistant" && (
              <View className="mb-1 flex-row items-center">
                <Ionicons name="sparkles" size={14} color="#8b5cf6" />
                <Text className="ml-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                  AI Assistant
                </Text>
              </View>
            )}
            <View
              className={`rounded-2xl p-3 ${
                item.role === "user"
                  ? "bg-primary-500"
                  : "bg-white dark:bg-dark-800"
              }`}
            >
              <Text
                className={
                  item.role === "user"
                    ? "text-white"
                    : "text-dark-900 dark:text-white"
                }
              >
                {item.content}
              </Text>
            </View>
            <Text
              className={`mt-0.5 text-xs ${
                item.role === "user" ? "text-right" : ""
              } text-dark-400`}
            >
              {item.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
      />

      {isLoading && (
        <View className="flex-row items-center px-4 py-2">
          <ActivityIndicator size="small" color="#8b5cf6" />
          <Text className="ml-2 text-sm text-dark-500 dark:text-dark-400">
            Thinking...
          </Text>
        </View>
      )}

      <View className="flex-row items-end border-t border-dark-200 bg-white p-3 dark:border-dark-700 dark:bg-dark-800">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything..."
          placeholderTextColor="#94a3b8"
          multiline
          className="mr-2 max-h-24 flex-1 rounded-xl bg-dark-100 px-4 py-2.5 text-base text-dark-900 dark:bg-dark-700 dark:text-white"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            input.trim() && !isLoading
              ? "bg-purple-500"
              : "bg-dark-300 dark:bg-dark-600"
          }`}
        >
          <Ionicons name="sparkles" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
