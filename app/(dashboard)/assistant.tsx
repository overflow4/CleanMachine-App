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
  Linking,
  Animated,
  Alert,
  Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAssistantConversations,
  fetchAssistantConversation,
  createAssistantConversation,
  deleteAssistantConversation,
  summarizeConversation,
  getSessionToken,
} from "@/lib/api";
import { API_URL } from "@/constants/config";
import { Theme } from "@/constants/colors";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ServerConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
  summary?: string;
}

interface DateGroup {
  label: string;
  conversations: ServerConversation[];
}

// ── Prompt suggestions for welcome screen ─────────────────────────────────

const PROMPT_SUGGESTIONS = [
  { icon: "analytics-outline" as const, text: "How are my earnings this week?" },
  { icon: "people-outline" as const, text: "Show me customers who need follow-up" },
  { icon: "calendar-outline" as const, text: "What jobs are scheduled for today?" },
  { icon: "trending-up-outline" as const, text: "Analyze my lead conversion rate" },
];

// ── Date grouping helper ──────────────────────────────────────────────────

function groupConversationsByDate(conversations: ServerConversation[]): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: Record<string, ServerConversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  for (const convo of conversations) {
    const d = new Date(convo.updatedAt);
    if (d >= today) {
      groups["Today"].push(convo);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(convo);
    } else if (d >= sevenDaysAgo) {
      groups["Previous 7 Days"].push(convo);
    } else if (d >= thirtyDaysAgo) {
      groups["Previous 30 Days"].push(convo);
    } else {
      groups["Older"].push(convo);
    }
  }

  return Object.entries(groups)
    .filter(([, convos]) => convos.length > 0)
    .map(([label, conversations]) => ({ label, conversations }));
}

// ── Smart timestamp ───────────────────────────────────────────────────────

function formatSmartTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// ── URL detection ─────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s)]+/g;

function splitWithUrls(text: string): { type: "text" | "url"; value: string }[] {
  const parts: { type: "text" | "url"; value: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "url", value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

// ── Markdown Renderer ─────────────────────────────────────────────────────

function renderMarkdown(text: string, baseStyle: any): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";
  let codeBlockStartIdx = 0;

  lines.forEach((line, lineIdx) => {
    // Fenced code block start/end
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockContent = [];
        codeBlockStartIdx = lineIdx;
      } else {
        inCodeBlock = false;
        const code = codeBlockContent.join("\n");
        elements.push(
          <CodeBlock key={`code-${codeBlockStartIdx}`} code={code} language={codeBlockLang} />
        );
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <Text key={`line-${lineIdx}`} style={[baseStyle, mdStyles.h2]}>
          {line.slice(3)}
        </Text>
      );
      return;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={`line-${lineIdx}`} style={[baseStyle, mdStyles.h3]}>
          {line.slice(4)}
        </Text>
      );
      return;
    }

    // H4
    if (line.startsWith("#### ")) {
      elements.push(
        <Text key={`line-${lineIdx}`} style={[baseStyle, mdStyles.h4]}>
          {line.slice(5)}
        </Text>
      );
      return;
    }

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
          <Text style={[baseStyle, mdStyles.numberBullet]}>{numberedMatch[1]}.</Text>
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

  // If code block was never closed, render remaining as code
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <CodeBlock
        key={`code-${codeBlockStartIdx}`}
        code={codeBlockContent.join("\n")}
        language={codeBlockLang}
      />
    );
  }

  return elements;
}

function renderInlineMarkdown(text: string, baseStyle: any): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code` in order of precedence
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      parts.push(...renderUrlSegment(segment, baseStyle, keyIdx));
      keyIdx++;
    }

    if (match[2]) {
      parts.push(
        <Text key={`md-b-${keyIdx++}`} style={[baseStyle, mdStyles.bold]}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      parts.push(
        <Text key={`md-i-${keyIdx++}`} style={[baseStyle, mdStyles.italic]}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      parts.push(
        <Text key={`md-c-${keyIdx++}`} style={mdStyles.inlineCode}>
          {match[4]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex);
    parts.push(...renderUrlSegment(segment, baseStyle, keyIdx));
  }

  return parts.length > 0 ? parts : [text];
}

function renderUrlSegment(
  text: string,
  baseStyle: any,
  baseKey: number
): React.ReactNode[] {
  const urlParts = splitWithUrls(text);
  return urlParts.map((part, i) => {
    if (part.type === "url") {
      return (
        <Text
          key={`url-${baseKey}-${i}`}
          style={[baseStyle, mdStyles.link]}
          onPress={() => Linking.openURL(part.value)}
        >
          {part.value}
        </Text>
      );
    }
    return part.value;
  });
}

// ── Code Block Component ──────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={mdStyles.codeBlock}>
      <View style={mdStyles.codeBlockHeader}>
        <Text style={mdStyles.codeBlockLang}>{language || "code"}</Text>
        <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={copied ? "checkmark" : "copy-outline"}
            size={14}
            color={copied ? Theme.success : Theme.zinc400}
          />
        </TouchableOpacity>
      </View>
      <Text style={mdStyles.codeBlockText}>{code}</Text>
    </View>
  );
}

const mdStyles = StyleSheet.create({
  h2: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  h3: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 3,
  },
  h4: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
  },
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
  link: {
    color: Theme.primaryLight,
    textDecorationLine: "underline",
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
  numberBullet: {
    width: 22,
    marginRight: 4,
  },
  listText: {
    flex: 1,
  },
  codeBlock: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Theme.border,
    overflow: "hidden",
  },
  codeBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  codeBlockLang: {
    fontSize: 11,
    color: Theme.zinc400,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textTransform: "uppercase",
  },
  codeBlockText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    color: Theme.foreground,
    padding: 12,
    lineHeight: 18,
  },
});

// ── Typing Indicator ──────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingRow}>
      <View style={styles.assistantLabel}>
        <Ionicons name="sparkles" size={14} color={Theme.primaryLight} />
        <Text style={styles.assistantLabelText}>AI Assistant</Text>
      </View>
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { opacity: dot }]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function AssistantScreen() {
  const queryClient = useQueryClient();
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const previousConvoIdRef = useRef<string | null>(null);

  // ── Server conversations query ──────────────────────────────────────
  const {
    data: serverConversations,
    isLoading: isLoadingConversations,
  } = useQuery({
    queryKey: ["assistant-conversations"],
    queryFn: async () => {
      const res: any = await fetchAssistantConversations();
      const raw = res.conversations || res.data?.conversations || res.data || [];
      const items = Array.isArray(raw) ? raw : [];
      return items
        .map((c: any) => ({
          id: String(c.id || c._id),
          title: c.title || "Untitled",
          messages: (c.messages || []).map((m: any, idx: number) => ({
            id: m.id || `msg-${c.id}-${idx}`,
            role: m.role as "user" | "assistant",
            content: m.content || "",
            timestamp: m.timestamp || m.created_at || c.updatedAt || c.updated_at || new Date().toISOString(),
          })),
          updatedAt: c.updatedAt || c.updated_at || new Date().toISOString(),
          summary: c.summary || undefined,
        }))
        .sort(
          (a: ServerConversation, b: ServerConversation) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ) as ServerConversation[];
    },
    staleTime: 30000,
  });

  const conversations = serverConversations || [];

  // ── Create conversation mutation ────────────────────────────────────
  const createConvoMutation = useMutation({
    mutationFn: async () => {
      const res: any = await createAssistantConversation();
      return res.conversation || res.data?.conversation || res.data || res;
    },
    onSuccess: (data: any) => {
      const newId = String(data.id || data._id);
      setActiveConvoId(newId);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    },
  });

  // ── Delete conversation mutation ────────────────────────────────────
  const deleteConvoMutation = useMutation({
    mutationFn: (id: string) => deleteAssistantConversation(id),
    onSuccess: (_data, deletedId) => {
      if (deletedId === activeConvoId) {
        setActiveConvoId(null);
        setMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    },
  });

  // ── Summarize previous conversation ─────────────────────────────────
  const summarizeMutation = useMutation({
    mutationFn: (id: string) => summarizeConversation(id),
  });

  // ── Load conversation messages when selected ────────────────────────
  const loadConversation = useCallback(
    async (convo: ServerConversation) => {
      // Auto-summarize previous conversation if it has 2+ user messages
      if (previousConvoIdRef.current && previousConvoIdRef.current !== convo.id) {
        const prevConvo = conversations.find((c) => c.id === previousConvoIdRef.current);
        if (prevConvo) {
          const realMessages = prevConvo.messages.filter((m) => m.role === "user");
          if (realMessages.length >= 2) {
            summarizeMutation.mutate(previousConvoIdRef.current);
          }
        }
      }

      setActiveConvoId(convo.id);
      previousConvoIdRef.current = convo.id;

      // Fetch full conversation from server
      try {
        const res: any = await fetchAssistantConversation(convo.id);
        const data = res.conversation || res.data?.conversation || res.data || res;
        const msgs = (data.messages || []).map((m: any, idx: number) => ({
          id: m.id || `msg-${convo.id}-${idx}`,
          role: m.role as "user" | "assistant",
          content: m.content || "",
          timestamp: m.timestamp || m.created_at || new Date().toISOString(),
        }));
        setMessages(msgs);
      } catch {
        // Fall back to cached messages
        setMessages(convo.messages);
      }

      setShowHistory(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [conversations, summarizeMutation]
  );

  // ── Streaming chat ──────────────────────────────────────────────────
  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    // If no active conversation, create one first
    let convoId = activeConvoId;
    if (!convoId) {
      try {
        const res: any = await createAssistantConversation();
        const data = res.conversation || res.data?.conversation || res.data || res;
        convoId = String(data.id || data._id);
        setActiveConvoId(convoId);
        previousConvoIdRef.current = convoId;
      } catch {
        // If creation fails, proceed without conversation ID
      }
    }

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const token = await getSessionToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Build messages payload for the API
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: apiMessages,
          ...(convoId ? { conversationId: convoId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      // Read the response as text progressively
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            const chunk = decoder.decode(result.value, { stream: !done });
            fullContent += chunk;
            setStreamingContent(fullContent);
          }
        }
      } else {
        // Fallback: read as text all at once
        const text = await response.text();
        fullContent = text;
        setStreamingContent(fullContent);
      }

      // Clean up streaming content - try to parse if it's JSON
      let finalContent = fullContent;
      try {
        const parsed = JSON.parse(fullContent);
        finalContent =
          parsed.content ||
          parsed.answer ||
          parsed.message ||
          parsed.data?.content ||
          parsed.data?.answer ||
          fullContent;
      } catch {
        // Not JSON, use raw text - might be SSE format
        // Parse SSE data lines
        const sseLines = fullContent.split("\n");
        const dataChunks: string[] = [];
        for (const line of sseLines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta =
                parsed.choices?.[0]?.delta?.content ||
                parsed.content ||
                parsed.text ||
                parsed.delta ||
                "";
              if (delta) dataChunks.push(delta);
            } catch {
              // Not JSON data line, use raw
              if (data.trim()) dataChunks.push(data);
            }
          }
        }
        if (dataChunks.length > 0) {
          finalContent = dataChunks.join("");
        }
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: finalContent || "I couldn't generate a response.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${err.message || "Unknown error"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
    }
  };

  // ── New conversation ────────────────────────────────────────────────
  const handleNewChat = () => {
    // Summarize previous if needed
    if (activeConvoId) {
      const userMsgCount = messages.filter((m) => m.role === "user").length;
      if (userMsgCount >= 2) {
        summarizeMutation.mutate(activeConvoId);
      }
    }

    setActiveConvoId(null);
    previousConvoIdRef.current = null;
    setMessages([]);
    setShowHistory(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Delete conversation ─────────────────────────────────────────────
  const handleDelete = (id: string) => {
    Alert.alert("Delete Conversation", "Are you sure you want to delete this conversation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteConvoMutation.mutate(id);
        },
      },
    ]);
  };

  // ── Copy entire conversation ────────────────────────────────────────
  const handleCopyChat = () => {
    const last100 = messages.slice(-100);
    const formatted = last100
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    Clipboard.setString(formatted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied", "Conversation copied to clipboard.");
  };

  // ── History Panel ───────────────────────────────────────────────────

  if (showHistory) {
    const grouped = groupConversationsByDate(conversations);

    return (
      <View style={styles.container}>
        <View style={styles.historyHeader}>
          <TouchableOpacity
            onPress={() => setShowHistory(false)}
            style={styles.historyBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Theme.foreground} />
          </TouchableOpacity>
          <Text style={styles.historyTitle}>Conversations</Text>
          <TouchableOpacity onPress={handleNewChat} style={styles.newConvoBtn}>
            <Ionicons name="add-circle-outline" size={22} color={Theme.primaryLight} />
            <Text style={styles.newConvoBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {isLoadingConversations ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Theme.primaryLight} />
            <Text style={styles.loadingLabel}>Loading conversations...</Text>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={Theme.zinc600} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>Start chatting to save conversations</Text>
          </View>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={(item) => item.label}
            style={styles.historyList}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item: group }) => (
              <View>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.conversations.map((convo) => (
                  <TouchableOpacity
                    key={convo.id}
                    style={[
                      styles.historyItem,
                      convo.id === activeConvoId && styles.historyItemActive,
                    ]}
                    onPress={() => loadConversation(convo)}
                  >
                    <View style={styles.historyItemContent}>
                      <View style={styles.historyItemIcon}>
                        <Ionicons
                          name="chatbubble-outline"
                          size={18}
                          color={convo.id === activeConvoId ? Theme.primaryLight : Theme.zinc400}
                        />
                      </View>
                      <View style={styles.historyItemText}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>
                          {convo.title}
                        </Text>
                        <Text style={styles.historyItemDate}>
                          {formatSmartTimestamp(convo.updatedAt)} ·{" "}
                          {convo.messages.length} messages
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(convo.id)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={Theme.zinc500} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // ── Welcome State ───────────────────────────────────────────────────

  const isWelcome = messages.length === 0 && !activeConvoId && !isStreaming;

  // ── Chat View ───────────────────────────────────────────────────────

  // Build display messages for inverted FlatList
  const displayMessages = [...messages].reverse();

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
        <View style={styles.topBarRight}>
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleCopyChat} style={styles.topBarButton}>
              <Ionicons name="copy-outline" size={18} color={Theme.zinc400} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleNewChat} style={styles.topBarButton}>
            <Ionicons name="add-circle-outline" size={20} color={Theme.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      {isWelcome ? (
        /* Welcome Screen */
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeIconContainer}>
            <Ionicons name="sparkles" size={48} color={Theme.primaryLight} />
          </View>
          <Text style={styles.welcomeTitle}>AI Assistant</Text>
          <Text style={styles.welcomeSubtitle}>
            Ask me anything about your business -- customers, jobs, revenue, or operations.
          </Text>
          <View style={styles.suggestionsContainer}>
            {PROMPT_SUGGESTIONS.map((suggestion, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestionChip}
                onPress={() => handleSend(suggestion.text)}
              >
                <Ionicons
                  name={suggestion.icon}
                  size={16}
                  color={Theme.primaryLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.suggestionText} numberOfLines={1}>
                  {suggestion.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        /* Messages */
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          inverted
          style={styles.messageList}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
          ListHeaderComponent={
            isStreaming ? (
              streamingContent ? (
                <View style={[styles.messageBubbleWrapper, styles.assistantAlign]}>
                  <View style={styles.assistantLabel}>
                    <Ionicons name="sparkles" size={14} color={Theme.primaryLight} />
                    <Text style={styles.assistantLabelText}>AI Assistant</Text>
                  </View>
                  <View style={[styles.bubble, styles.assistantBubble]}>
                    <View>{renderMarkdown(streamingContent, styles.assistantBubbleText)}</View>
                  </View>
                </View>
              ) : (
                <TypingIndicator />
              )
            ) : null
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
                {item.role === "assistant" ? (
                  <View>{renderMarkdown(item.content, styles.assistantBubbleText)}</View>
                ) : (
                  <Text style={styles.userBubbleText}>{item.content}</Text>
                )}

                {item.role === "assistant" && (
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setString(item.content);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.copyButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="copy-outline" size={14} color={Theme.zinc500} />
                  </TouchableOpacity>
                )}
              </View>
              <Text
                style={[
                  styles.timestamp,
                  item.role === "user" ? { textAlign: "right" } : {},
                ]}
              >
                {formatSmartTimestamp(item.timestamp)}
              </Text>
            </View>
          )}
        />
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
          editable={!isStreaming}
          onSubmitEditing={() => handleSend()}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!input.trim() || isStreaming}
          style={[
            styles.sendButton,
            input.trim() && !isStreaming ? styles.sendButtonActive : styles.sendButtonDisabled,
          ]}
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="sparkles" size={18} color="white" />
          )}
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

  // Center container (loading / empty)
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },
  loadingLabel: {
    marginTop: 12,
    fontSize: 14,
    color: Theme.mutedForeground,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: 4,
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
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // Welcome state
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  welcomeIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Theme.foreground,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Theme.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  suggestionsContainer: {
    width: "100%",
    gap: 10,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  suggestionText: {
    fontSize: 14,
    color: Theme.foreground,
    flex: 1,
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
    borderWidth: 1,
    borderColor: Theme.border,
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

  // Typing indicator
  typingRow: {
    alignSelf: "flex-start",
    marginBottom: 12,
    maxWidth: "85%",
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.primaryLight,
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
  groupLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.zinc400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  historyItem: {
    marginHorizontal: 12,
    marginBottom: 2,
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
});
