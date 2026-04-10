import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Share,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { brainQuery } from "@/lib/api";
import { Theme } from "@/constants/colors";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string for serialization
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

const STORAGE_KEY = "assistant_conversations";
const MAX_CONVERSATIONS = 20;

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your AI assistant. Ask me anything about your business — customers, jobs, revenue, or operations.",
  timestamp: new Date().toISOString(),
};

// ── Markdown Renderer ──────────────────────────────────────────────────────

function renderMarkdown(text: string, baseStyle: any): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, "");
      elements.push(
        <View key={`line-${lineIdx}`} style={mdStyles.listItem}>
          <Text style={[baseStyle, mdStyles.bullet]}>{"\u2022"}</Text>
          <Text style={[baseStyle, mdStyles.listText]}>
            {renderInlineMarkdown(content, baseStyle)}
          </Text>
        </View>
      );
      return;
    }

    // Numbered list
    const numberedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (numberedMatch) {
      elements.push(
        <View key={`line-${lineIdx}`} style={mdStyles.listItem}>
          <Text style={[baseStyle, mdStyles.bullet]}>{numberedMatch[1]}.</Text>
          <Text style={[baseStyle, mdStyles.listText]}>
            {renderInlineMarkdown(numberedMatch[2], baseStyle)}
          </Text>
        </View>
      );
      return;
    }

    // Empty line = spacing
    if (line.trim() === "") {
      elements.push(<View key={`line-${lineIdx}`} style={{ height: 6 }} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <Text key={`line-${lineIdx}`} style={baseStyle}>
        {renderInlineMarkdown(line, baseStyle)}
      </Text>
    );
  });

  return elements;
}

function renderInlineMarkdown(
  text: string,
  baseStyle: any
): React.ReactNode[] {
  // Split by inline patterns: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  // Regex matches **bold**, *italic*, `code` in order of precedence
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <Text key={`md-${keyIdx++}`} style={[baseStyle, mdStyles.bold]}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <Text key={`md-${keyIdx++}`} style={[baseStyle, mdStyles.italic]}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      // `code`
      parts.push(
        <Text key={`md-${keyIdx++}`} style={mdStyles.inlineCode}>
          {match[4]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

const mdStyles = StyleSheet.create({
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  inlineCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: Theme.primaryLight,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
    paddingRight: 8,
  },
  bullet: {
    width: 16,
    marginRight: 4,
  },
  listText: {
    flex: 1,
  },
});

// ── Storage helpers ────────────────────────────────────────────────────────

async function loadConversations(): Promise<Conversation[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

async function saveConversations(convos: Conversation[]): Promise<void> {
  // Keep only latest MAX_CONVERSATIONS
  const trimmed = convos.slice(0, MAX_CONVERSATIONS);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(trimmed));
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AssistantScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations().then((convos) => {
      setConversations(convos);
    });
  }, []);

  // Persist current conversation after each message exchange
  const persistConversation = useCallback(
    async (msgs: ChatMessage[]) => {
      // Don't persist if only the welcome message exists
      const realMessages = msgs.filter((m) => m.id !== "welcome");
      if (realMessages.length === 0) return;

      const firstUserMsg = realMessages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 50) +
          (firstUserMsg.content.length > 50 ? "..." : "")
        : "New conversation";

      const convoId = activeConvoId || Date.now().toString();
      if (!activeConvoId) {
        setActiveConvoId(convoId);
      }

      const updatedConvo: Conversation = {
        id: convoId,
        title,
        messages: msgs,
        updatedAt: new Date().toISOString(),
      };

      const existing = await loadConversations();
      const filtered = existing.filter((c) => c.id !== convoId);
      const updated = [updatedConvo, ...filtered];
      await saveConversations(updated);
      setConversations(updated);
    },
    [activeConvoId]
  );

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result: any = await brainQuery(userMessage.content);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          result.answer ||
          result.data?.answer ||
          result.message ||
          "I couldn't find an answer to that.",
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await persistConversation(finalMessages);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      await persistConversation(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConvoId(null);
    setMessages([WELCOME_MESSAGE]);
    setShowHistory(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLoadConversation = (convo: Conversation) => {
    setActiveConvoId(convo.id);
    setMessages(convo.messages);
    setShowHistory(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteConversation = async (convoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = conversations.filter((c) => c.id !== convoId);
    setConversations(updated);
    await saveConversations(updated);

    // If we deleted the active conversation, start fresh
    if (convoId === activeConvoId) {
      setActiveConvoId(null);
      setMessages([WELCOME_MESSAGE]);
    }
  };

  const handleShareMessage = async (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: text });
    } catch {
      // User cancelled or share failed — no action needed
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  // ── History Panel ──────────────────────────────────────────────────────

  if (showHistory) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.historyHeader}>
          <TouchableOpacity
            onPress={() => setShowHistory(false)}
            style={styles.historyBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Theme.foreground} />
          </TouchableOpacity>
          <Text style={styles.historyTitle}>Conversations</Text>
          <TouchableOpacity
            onPress={handleNewConversation}
            style={styles.newConvoBtn}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={Theme.primaryLight}
            />
            <Text style={styles.newConvoBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Conversation List */}
        {conversations.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={Theme.zinc600}
            />
            <Text style={styles.emptyHistoryText}>No conversations yet</Text>
            <Text style={styles.emptyHistorySubtext}>
              Start chatting to save conversations
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.historyList}>
            {conversations.map((convo) => (
              <TouchableOpacity
                key={convo.id}
                style={[
                  styles.historyItem,
                  convo.id === activeConvoId && styles.historyItemActive,
                ]}
                onPress={() => handleLoadConversation(convo)}
              >
                <View style={styles.historyItemContent}>
                  <View style={styles.historyItemIcon}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={18}
                      color={
                        convo.id === activeConvoId
                          ? Theme.primaryLight
                          : Theme.zinc400
                      }
                    />
                  </View>
                  <View style={styles.historyItemText}>
                    <Text
                      style={styles.historyItemTitle}
                      numberOfLines={1}
                    >
                      {convo.title}
                    </Text>
                    <Text style={styles.historyItemDate}>
                      {formatDate(convo.updatedAt)} ·{" "}
                      {convo.messages.filter((m) => m.id !== "welcome").length}{" "}
                      messages
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteConversation(convo.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.deleteBtn}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={Theme.zinc500}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Chat View ──────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={112}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => setShowHistory(true)}
          style={styles.topBarButton}
        >
          <Ionicons name="time-outline" size={20} color={Theme.foreground} />
          <Text style={styles.topBarButtonText}>History</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>AI Assistant</Text>
        <TouchableOpacity
          onPress={handleNewConversation}
          style={styles.topBarButton}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={Theme.primaryLight}
          />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
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
                <Ionicons
                  name="sparkles"
                  size={14}
                  color={Theme.primaryLight}
                />
                <Text style={styles.assistantLabelText}>AI Assistant</Text>
              </View>
            )}
            <View
              style={[
                styles.bubble,
                item.role === "user"
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              {item.role === "assistant" ? (
                <View>
                  {renderMarkdown(item.content, styles.assistantBubbleText)}
                </View>
              ) : (
                <Text style={styles.userBubbleText}>{item.content}</Text>
              )}

              {/* Copy/Share button for assistant messages */}
              {item.role === "assistant" && item.id !== "welcome" && (
                <TouchableOpacity
                  onPress={() => handleShareMessage(item.content)}
                  style={styles.copyButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="copy-outline"
                    size={14}
                    color={Theme.zinc500}
                  />
                </TouchableOpacity>
              )}
            </View>
            <Text
              style={[
                styles.timestamp,
                item.role === "user" ? { textAlign: "right" } : {},
              ]}
            >
              {formatTime(item.timestamp)}
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

      {/* Input Bar */}
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
            input.trim() && !isLoading
              ? styles.sendButtonActive
              : styles.sendButtonDisabled,
          ]}
        >
          <Ionicons name="sparkles" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  topBarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  topBarButtonText: {
    fontSize: 13,
    color: Theme.foreground,
    marginLeft: 2,
  },

  // Message list
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
    lineHeight: 22,
  },
  timestamp: {
    marginTop: 2,
    fontSize: 11,
    color: Theme.zinc400,
  },

  // Copy button
  copyButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    padding: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  // Loading
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

  // Input bar
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

  // History panel
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
  },
  historyBackBtn: {
    padding: 4,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
  },
  newConvoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newConvoBtnText: {
    fontSize: 14,
    color: Theme.primaryLight,
    fontWeight: "500",
  },
  historyList: {
    flex: 1,
    paddingTop: 8,
  },
  historyItem: {
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  historyItemActive: {
    backgroundColor: Theme.primaryMuted,
  },
  historyItemContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  historyItemIcon: {
    marginRight: 12,
  },
  historyItemText: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: Theme.foreground,
    marginBottom: 2,
  },
  historyItemDate: {
    fontSize: 12,
    color: Theme.zinc400,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 8,
  },

  // Empty history
  emptyHistory: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: 4,
  },
});
