import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../src/store';

const AVATAR_STYLES = [
  'bottts-neutral', 'adventurer-neutral', 'pixel-art-neutral',
  'micah', 'identicon', 'rings',
];

export default function ProfileScreen() {
  const { username, avatar, setUsername, randomizeAvatar, setAvatar } = useUserStore();
  const [inputName, setInputName] = useState(username);
  const [error, setError] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(0);

  const previewAvatar = inputName
    ? `https://api.dicebear.com/7.x/${AVATAR_STYLES[selectedStyle]}/svg?seed=${encodeURIComponent(inputName)}&backgroundColor=transparent`
    : avatar || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default';

  const handleSave = () => {
    const trimmed = inputName.trim();
    if (!trimmed || trimmed.length < 2) { setError('Username must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setError('Username must be under 20 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Only letters, numbers, and underscores'); return; }
    setError('');
    setUsername(trimmed);
    const newAvatar = `https://api.dicebear.com/7.x/${AVATAR_STYLES[selectedStyle]}/svg?seed=${encodeURIComponent(trimmed)}&backgroundColor=transparent`;
    setAvatar(newAvatar);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050508' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={22} color="#E8E8F0" />
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#E8E8F0' }}>Your Profile</Text>
          </View>

          {/* Avatar preview */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{
              width: 110, height: 110, borderRadius: 55,
              backgroundColor: '#13131C', borderWidth: 2, borderColor: '#7C3AED',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              <Image source={{ uri: previewAvatar }} style={{ width: 90, height: 90 }} />
            </View>
            <Text style={{ color: '#6B6B85', fontSize: 12, marginTop: 10 }}>
              Auto-generated from username
            </Text>
          </View>

          {/* Avatar style picker */}
          <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Avatar Style
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {AVATAR_STYLES.map((style, idx) => {
                const seed = inputName || 'preview';
                const uri = `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
                return (
                  <TouchableOpacity
                    key={style}
                    onPress={() => setSelectedStyle(idx)}
                    style={{
                      width: 60, height: 60, borderRadius: 12, backgroundColor: '#13131C',
                      borderWidth: 2, borderColor: selectedStyle === idx ? '#7C3AED' : '#1E1E2E',
                      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}
                  >
                    <Image source={{ uri }} style={{ width: 48, height: 48 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Username input */}
          <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Username
          </Text>
          <TextInput
            value={inputName}
            onChangeText={(t) => { setInputName(t); setError(''); }}
            placeholder="Enter username..."
            placeholderTextColor="#6B6B85"
            autoCapitalize="none"
            maxLength={20}
            style={{
              backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 16,
              paddingVertical: 14, color: '#E8E8F0', fontSize: 16, fontWeight: '600',
              borderWidth: 1, borderColor: error ? '#EF4444' : '#1E1E2E', marginBottom: 8,
            }}
          />
          {error ? <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
          <Text style={{ color: '#6B6B85', fontSize: 11, marginBottom: 28 }}>
            Letters, numbers, and underscores only. 2–20 characters.
          </Text>

          {/* Privacy note */}
          <View style={{
            backgroundColor: '#0D0D14', borderRadius: 12, padding: 14, marginBottom: 28,
            borderWidth: 1, borderColor: '#1E1E2E', flexDirection: 'row', gap: 10,
          }}>
            <Ionicons name="information-circle" size={18} color="#7C3AED" />
            <Text style={{ flex: 1, color: '#6B6B85', fontSize: 12, lineHeight: 18 }}>
              No account needed. Your username is stored locally on your device only.
              No email, no password, no tracking.
            </Text>
          </View>

          {/* Save button */}
          <TouchableOpacity
            onPress={handleSave}
            style={{
              backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {username ? 'Update Profile' : 'Set Username & Continue'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
