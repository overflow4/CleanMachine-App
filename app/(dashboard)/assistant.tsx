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
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { brainQuery } from "@/lib/api";
import { Theme } from "@/constants/colors";

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={112}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubbleWrapper,
              item.role === "user" ? styles.userAlign : styles.assistantAlign,
            ]}
          >
            {item.role === "assistant" && (
              <View style={styles.assistantLabel}>
                <Ionicons name="sparkles" size={14} color={Theme.primaryLight} />
                <Text style={styles.assistantLabelText}>AI Assistant</Text>
              </View>
            )}
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={item.role === "user" ? styles.userBubbleText : styles.assistantBubbleText}
              >
                {item.content}
              </Text>
            </View>
            <Text
              style={[
                styles.timestamp,
                item.role === "user" ? { textAlign: "right" } : {},
              ]}
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
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Theme.primaryLight} />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything..."
          placeholderTextColor={Theme.mutedForeground}
          multiline
          style={styles.textInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
          style={[
            styles.sendButton,
            input.trim() && !isLoading ? styles.sendButtonActive : styles.sendButtonDisabled,
          ]}
        >
          <Ionicons name="sparkles" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageBubbleWrapper: {
    marginBottom: 12,
    maxWidth: "85%",
  },
  userAlign: {
    alignSelf: "flex-end",
  },
  assistantAlign: {
    alignSelf: "flex-start",
  },
  assistantLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  assistantLabelText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.primaryLight,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: Theme.primary,
  },
  assistantBubble: {
    backgroundColor: Theme.card,
  },
  userBubbleText: {
    color: "#ffffff",
    fontSize: 15,
  },
  assistantBubbleText: {
    color: Theme.foreground,
    fontSize: 15,
  },
  timestamp: {
    marginTop: 2,
    fontSize: 11,
    color: Theme.zinc400,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    backgroundColor: Theme.card,
    padding: 12,
  },
  textInput: {
    flex: 1,
    marginRight: 8,
    maxHeight: 96,
    borderRadius: 12,
    backgroundColor: Theme.muted,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Theme.foreground,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonActive: {
    backgroundColor: Theme.primary,
  },
  sendButtonDisabled: {
    backgroundColor: Theme.zinc600,
  },
});
