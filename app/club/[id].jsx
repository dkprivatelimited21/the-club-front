import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Animated, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useUserStore, useClubStore } from '../../src/store';
import { getSocket } from '../../src/utils/socket';
import { API_URL, SERVER_URL, MAX_MESSAGE_LENGTH } from '../../src/utils/config';

const { width } = Dimensions.get('window');
const REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '💯'];

export default function ClubScreen() {
  const { id: clubId, pin } = useLocalSearchParams();
  const { username, avatar, socketId, setSocketId } = useUserStore();
  const { currentClub, messages, media, onlineUsers, typingUsers,
    setClub, clearClub, addMessage, setMessages, addMedia, setMedia,
    setOnlineUsers, addTypingUser, updateMessageReaction } = useClubStore();

  const [messageText, setMessageText] = useState('');
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showReactions, setShowReactions] = useState(null); // messageId
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);
  const inputRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (!username) { router.replace('/profile'); return; }
    if (!clubId) { router.replace('/'); return; }
    joinClub();
    return () => leaveClub();
  }, []);

  const joinClub = useCallback(() => {
    const socket = getSocket();
    setSocketId(socket.id);

    // Register event listeners
    socket.on('newMessage', (msg) => addMessage(msg));
    socket.on('newMedia', (item) => addMedia(item));
    socket.on('userJoined', ({ user, users, userCount }) => {
      setOnlineUsers(users || []);
      if (user.username !== username) {
        addMessage({ id: Date.now().toString(), type: 'system', text: `${user.username} joined 👋`, timestamp: Date.now() });
      }
    });
    socket.on('userLeft', ({ username: leftUser, users }) => {
      setOnlineUsers(users || []);
      addMessage({ id: Date.now().toString(), type: 'system', text: `${leftUser} left`, timestamp: Date.now() });
    });
    socket.on('usersUpdate', ({ users }) => setOnlineUsers(users || []));
    socket.on('userTyping', (data) => addTypingUser(data));
    socket.on('messageReaction', ({ messageId, reactions }) => updateMessageReaction(messageId, reactions));
    socket.on('disconnect', () => {
      addMessage({ id: Date.now().toString(), type: 'system', text: '⚠️ Disconnected. Reconnecting...', timestamp: Date.now() });
    });

    socket.emit('joinClub', { clubId, pin: pin || undefined, username, avatar }, (res) => {
      setJoining(false);
      if (res.error) { setError(res.error); return; }
      setJoined(true);
      setClub(res.club);
      setMessages(res.recentMessages || []);
      setMedia(res.recentMedia || []);
      setOnlineUsers(res.club.users || []);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    });
  }, [clubId, pin, username, avatar]);

  const leaveClub = useCallback(() => {
    const socket = getSocket();
    socket.off('newMessage');
    socket.off('newMedia');
    socket.off('userJoined');
    socket.off('userLeft');
    socket.off('usersUpdate');
    socket.off('userTyping');
    socket.off('messageReaction');
    socket.off('disconnect');
    socket.emit('leaveClub');
    clearClub();
  }, []);

  const sendMessage = useCallback(() => {
    const text = messageText.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;
    const socket = getSocket();
    socket.emit('sendMessage', { text }, (res) => {
      if (res?.error) Alert.alert('Error', res.error);
    });
    setMessageText('');
    sendTyping(false);
  }, [messageText]);

  const sendTyping = useCallback((isTyping) => {
    const socket = getSocket();
    socket.emit('typing', { isTyping });
  }, []);

  const handleTyping = (text) => {
    setMessageText(text);
    sendTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 2000);
  };

  const handlePickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission denied', 'Allow photo access to share media.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      uploadMedia(result.assets[0]);
    }
  };

  const uploadMedia = async (asset) => {
    setUploadingMedia(true);
    try {
      const socket = getSocket();
      const formData = new FormData();
      const filename = asset.uri.split('/').pop();
      const ext = filename.split('.').pop().toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      formData.append('media', { uri: asset.uri, name: filename, type: mimeType });

      const res = await fetch(`${API_URL}/media/upload`, {
        method: 'POST',
        headers: { 'x-socket-id': socket.id },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const copyClubId = async () => {
    await Clipboard.setStringAsync(clubId);
    Alert.alert('Copied!', `Club ID "${clubId}" copied to clipboard`);
  };

  const handleReact = (messageId, emoji) => {
    const socket = getSocket();
    socket.emit('reactMessage', { messageId, emoji });
    setShowReactions(null);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  if (joining) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050508', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7C3AED" size="large" />
        <Text style={{ color: '#6B6B85', marginTop: 16, fontSize: 15 }}>Joining club...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050508', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="alert-circle" size={50} color="#EF4444" />
        <Text style={{ color: '#EF4444', fontSize: 20, fontWeight: '700', marginTop: 16 }}>Can't Join</Text>
        <Text style={{ color: '#6B6B85', fontSize: 15, marginTop: 8, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={() => router.replace('/')} style={{
          marginTop: 24, backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14,
        }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const allItems = [
    ...messages.map(m => ({ ...m, itemType: 'message' })),
    ...media.map(m => ({ ...m, itemType: 'media' })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050508' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#1E1E2E', backgroundColor: '#0D0D14',
      }}>
        <TouchableOpacity onPress={() => { leaveClub(); router.replace('/'); }} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#E8E8F0" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#E8E8F0', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
            {currentClub?.name || clubId}
          </Text>
          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>
            {onlineUsers.length} online
          </Text>
        </View>
        <TouchableOpacity onPress={copyClubId} style={{ marginRight: 12 }}>
          <Ionicons name="copy-outline" size={20} color="#6B6B85" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowUsers(!showUsers)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people" size={20} color={showUsers ? '#7C3AED' : '#6B6B85'} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Club ID banner */}
      <View style={{ backgroundColor: '#0D0D14', paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="link" size={12} color="#6B6B85" />
        <Text style={{ color: '#6B6B85', fontSize: 11 }}>Club ID: </Text>
        <Text style={{ color: '#9F67FF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{clubId}</Text>
        {currentClub?.type === 'hidden' && <Ionicons name="lock-closed" size={11} color="#6B6B85" />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Users sidebar overlay */}
        {showUsers && (
          <TouchableOpacity
            onPress={() => setShowUsers(false)}
            activeOpacity={1}
            style={{ position: 'absolute', inset: 0, zIndex: 10, flexDirection: 'row' }}
          >
            <View style={{ flex: 1 }} />
            <View style={{
              width: 220, backgroundColor: '#0D0D14', borderLeftWidth: 1, borderLeftColor: '#1E1E2E',
              padding: 16,
            }}>
              <Text style={{ color: '#6B6B85', fontSize: 11, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                Online — {onlineUsers.length}
              </Text>
              {onlineUsers.map((u, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ position: 'relative' }}>
                    <Image source={{ uri: u.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#0D0D14' }} />
                  </View>
                  <Text style={{ color: '#E8E8F0', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                    {u.username}
                    {u.username === currentClub?.host ? ' 👑' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}

        {/* Messages */}
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          <FlatList
            ref={flatListRef}
            data={allItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 12, gap: 4 }}
            onContentSizeChange={scrollToBottom}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.type === 'system') {
                return (
                  <View style={{ alignItems: 'center', marginVertical: 4 }}>
                    <Text style={{ color: '#6B6B85', fontSize: 11, backgroundColor: '#0D0D14', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                      {item.text}
                    </Text>
                  </View>
                );
              }
              if (item.itemType === 'media') {
                return <MediaBubble item={item} isMine={item.username === username} serverUrl={SERVER_URL} />;
              }
              return (
                <MessageBubble
                  msg={item}
                  isMine={item.username === username}
                  onLongPress={() => setShowReactions(item.id)}
                  showReactions={showReactions === item.id}
                  onReact={(emoji) => handleReact(item.id, emoji)}
                  onDismiss={() => setShowReactions(null)}
                />
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Text style={{ fontSize: 40 }}>🎭</Text>
                <Text style={{ color: '#6B6B85', marginTop: 12, textAlign: 'center' }}>
                  Club is open! Say something...
                </Text>
                <Text style={{ color: '#4C1D95', fontSize: 11, marginTop: 6 }}>
                  Messages disappear after 10 minutes
                </Text>
              </View>
            }
          />
        </Animated.View>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <Text style={{ color: '#6B6B85', fontSize: 12 }}>
              {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </Text>
          </View>
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
          borderTopWidth: 1, borderTopColor: '#1E1E2E', backgroundColor: '#0D0D14', gap: 8,
        }}>
          <TouchableOpacity
            onPress={handlePickMedia}
            disabled={uploadingMedia}
            style={{
              width: 40, height: 40, borderRadius: 20, backgroundColor: '#13131C',
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1E1E2E',
            }}
          >
            {uploadingMedia ? (
              <ActivityIndicator color="#7C3AED" size="small" />
            ) : (
              <Ionicons name="image" size={18} color="#7C3AED" />
            )}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={messageText}
            onChangeText={handleTyping}
            placeholder="Say something..."
            placeholderTextColor="#6B6B85"
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            style={{
              flex: 1, backgroundColor: '#13131C', borderRadius: 20, paddingHorizontal: 14,
              paddingVertical: 10, color: '#E8E8F0', fontSize: 15, maxHeight: 100,
              borderWidth: 1, borderColor: '#1E1E2E',
            }}
          />

          <TouchableOpacity
            onPress={sendMessage}
            disabled={!messageText.trim()}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: messageText.trim() ? '#7C3AED' : '#13131C',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="send" size={16} color={messageText.trim() ? '#fff' : '#6B6B85'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, onLongPress, showReactions, onReact, onDismiss }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  const totalReactions = msg.reactions
    ? Object.entries(msg.reactions).filter(([_, users]) => users.length > 0)
    : [];

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        onLongPress={onLongPress}
        activeOpacity={0.8}
        style={{
          flexDirection: isMine ? 'row-reverse' : 'row',
          alignItems: 'flex-end', gap: 8, marginVertical: 2,
        }}
      >
        {!isMine && (
          <Image source={{ uri: msg.avatar }} style={{ width: 28, height: 28, borderRadius: 14, marginBottom: 2 }} />
        )}
        <View style={{ maxWidth: '75%' }}>
          {!isMine && (
            <Text style={{ color: msg.color || '#9F67FF', fontSize: 11, fontWeight: '700', marginBottom: 3, marginLeft: 4 }}>
              {msg.username}
            </Text>
          )}
          <View style={{
            backgroundColor: isMine ? '#7C3AED' : '#13131C',
            borderRadius: 18,
            borderBottomRightRadius: isMine ? 4 : 18,
            borderBottomLeftRadius: isMine ? 18 : 4,
            paddingHorizontal: 14, paddingVertical: 10,
            borderWidth: isMine ? 0 : 1, borderColor: '#1E1E2E',
          }}>
            <Text style={{ color: isMine ? '#fff' : '#E8E8F0', fontSize: 15, lineHeight: 21 }}>
              {msg.text}
            </Text>
          </View>
          {totalReactions.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingHorizontal: 4 }}>
              {totalReactions.map(([emoji, users]) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => onReact(emoji)}
                  style={{ backgroundColor: '#13131C', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', gap: 3, borderWidth: 1, borderColor: '#1E1E2E' }}
                >
                  <Text style={{ fontSize: 12 }}>{emoji}</Text>
                  <Text style={{ color: '#6B6B85', fontSize: 11 }}>{users.length}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={{ color: '#6B6B85', fontSize: 10, marginTop: 3, textAlign: isMine ? 'right' : 'left', paddingHorizontal: 4 }}>
            {formatTime(msg.timestamp)}
          </Text>
        </View>
      </TouchableOpacity>

      {showReactions && (
        <TouchableOpacity activeOpacity={1} onPress={onDismiss} style={{ position: 'absolute', bottom: -40, left: isMine ? undefined : 40, right: isMine ? 0 : undefined, zIndex: 99 }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#13131C', borderRadius: 20, padding: 8, gap: 6, borderWidth: 1, borderColor: '#1E1E2E' }}>
            {REACTIONS.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => onReact(emoji)}>
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── Media Bubble ─────────────────────────────────────────────────────────────
function MediaBubble({ item, isMine, serverUrl }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const uri = `${serverUrl}${item.url}`;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={{
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end', gap: 8, marginVertical: 4,
      }}>
        {!isMine && (
          <Image source={{ uri: item.avatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
        )}
        <View style={{ maxWidth: '70%' }}>
          {!isMine && (
            <Text style={{ color: item.color || '#9F67FF', fontSize: 11, fontWeight: '700', marginBottom: 3, marginLeft: 4 }}>
              {item.username}
            </Text>
          )}
          <View style={{
            borderRadius: 14, overflow: 'hidden',
            borderWidth: 1, borderColor: isMine ? '#7C3AED' : '#1E1E2E',
          }}>
            <Image source={{ uri }} style={{ width: 200, height: 160 }} resizeMode="cover" />
            <View style={{ backgroundColor: '#0D0D14', paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="time-outline" size={10} color="#6B6B85" />
              <Text style={{ color: '#6B6B85', fontSize: 10 }}>Expires in 5 min</Text>
            </View>
          </View>
          <Text style={{ color: '#6B6B85', fontSize: 10, marginTop: 3, textAlign: isMine ? 'right' : 'left', paddingHorizontal: 4 }}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
