import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore, useClubStore } from '../src/store';
import { getSocket } from '../src/utils/socket';

const CLUB_TYPES = [
  { id: 'public', label: 'Public', icon: 'globe', desc: 'Anyone can find and join' },
  { id: 'private', label: 'Private', icon: 'link', desc: 'Join via link only' },
  { id: 'hidden', label: 'Hidden', icon: 'lock-closed', desc: 'Requires PIN to join' },
];

export default function CreateClubScreen() {
  const { username, avatar } = useUserStore();
  const { setClub, setMessages, setMedia, setOnlineUsers } = useClubStore();
  const [clubName, setClubName] = useState('');
  const [clubType, setClubType] = useState('public');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = () => {
    const name = clubName.trim();
    if (!name || name.length < 2) { setError('Club name must be at least 2 characters'); return; }
    if (clubType === 'hidden' && (!pin || pin.length < 4)) { setError('PIN must be at least 4 characters'); return; }
    setError('');
    setLoading(true);

    const socket = getSocket();

    socket.emit('createClub', {
      name,
      type: clubType,
      pin: clubType === 'hidden' ? pin : undefined,
      username,
      avatar,
    }, (res) => {
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      setClub(res.club);
      setMessages([]);
      setMedia([]);
      setOnlineUsers(res.club.users || []);
      router.replace(`/club/${res.clubId}`);
    });

    setTimeout(() => { setLoading(false); setError('Connection timeout. Try again.'); }, 10000);
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
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#E8E8F0' }}>Create a Club</Text>
          </View>

          {/* Club name */}
          <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Club Name
          </Text>
          <TextInput
            value={clubName}
            onChangeText={(t) => { setClubName(t); setError(''); }}
            placeholder="e.g. Late Night Vibes"
            placeholderTextColor="#6B6B85"
            maxLength={30}
            style={{
              backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 16,
              paddingVertical: 14, color: '#E8E8F0', fontSize: 16, fontWeight: '600',
              borderWidth: 1, borderColor: '#1E1E2E', marginBottom: 28,
            }}
          />

          {/* Club type */}
          <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Club Type
          </Text>
          <View style={{ gap: 10, marginBottom: 28 }}>
            {CLUB_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                onPress={() => { setClubType(type.id); setError(''); }}
                style={{
                  backgroundColor: '#13131C', borderRadius: 14, padding: 16,
                  borderWidth: 1.5, borderColor: clubType === type.id ? '#7C3AED' : '#1E1E2E',
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 10,
                  backgroundColor: clubType === type.id ? '#4C1D95' : '#0D0D14',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={type.icon} size={18} color={clubType === type.id ? '#9F67FF' : '#6B6B85'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#E8E8F0', fontWeight: '700', fontSize: 15 }}>{type.label}</Text>
                  <Text style={{ color: '#6B6B85', fontSize: 12, marginTop: 2 }}>{type.desc}</Text>
                </View>
                {clubType === type.id && <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* PIN input for hidden clubs */}
          {clubType === 'hidden' && (
            <View style={{ marginBottom: 28 }}>
              <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Club PIN
              </Text>
              <TextInput
                value={pin}
                onChangeText={(t) => { setPin(t); setError(''); }}
                placeholder="Set a PIN (min 4 chars)"
                placeholderTextColor="#6B6B85"
                secureTextEntry
                maxLength={12}
                style={{
                  backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 16,
                  paddingVertical: 14, color: '#E8E8F0', fontSize: 16, fontWeight: '600',
                  borderWidth: 1, borderColor: '#1E1E2E',
                }}
              />
            </View>
          )}

          {/* Ephemeral reminder */}
          <View style={{
            backgroundColor: '#0D0D14', borderRadius: 12, padding: 14, marginBottom: 28,
            borderWidth: 1, borderColor: '#1E1E2E',
          }}>
            <Text style={{ color: '#6B6B85', fontSize: 12, lineHeight: 18 }}>
              ⏱️ Club auto-deletes when everyone leaves.{'\n'}
              💬 Messages expire after 10 minutes.{'\n'}
              🖼️ Media expires after 5 minutes.
            </Text>
          </View>

          {error ? (
            <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text>
          ) : null}

          {/* Create button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#4C1D95' : '#7C3AED', borderRadius: 14, paddingVertical: 16,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Open The Club</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
