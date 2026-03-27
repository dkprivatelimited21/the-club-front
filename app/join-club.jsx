import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../src/utils/config';

export default function JoinClubScreen() {
  const [clubId, setClubId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [clubInfo, setClubInfo] = useState(null);

  const handleLookup = async () => {
    const id = clubId.trim().toUpperCase();
    if (!id) { setError('Enter a Club ID'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/clubs/${id}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Club not found'); setLoading(false); return; }
      setClubInfo(data);
      if (data.requiresPin) {
        setRequiresPin(true);
      } else {
        router.push(`/club/${id}`);
      }
    } catch (e) {
      setError('Failed to reach server');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithPin = async () => {
    if (!pin) { setError('Enter the PIN'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/clubs/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: clubId.trim().toUpperCase(), pin }),
      });
      const data = await res.json();
      if (!data.valid) { setError('Incorrect PIN'); setLoading(false); return; }
      router.push(`/club/${clubId.trim().toUpperCase()}?pin=${pin}`);
    } catch (e) {
      setError('Failed to verify PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050508' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={22} color="#E8E8F0" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#E8E8F0' }}>Join a Club</Text>
        </View>

        {!requiresPin ? (
          <View>
            <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Club ID
            </Text>
            <TextInput
              value={clubId}
              onChangeText={(t) => { setClubId(t.toUpperCase()); setError(''); }}
              placeholder="Enter Club ID (e.g. A1B2C3D4)"
              placeholderTextColor="#6B6B85"
              autoCapitalize="characters"
              style={{
                backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 16,
                paddingVertical: 14, color: '#E8E8F0', fontSize: 16, fontWeight: '600',
                borderWidth: 1, borderColor: error ? '#EF4444' : '#1E1E2E',
                letterSpacing: 2, marginBottom: 24,
              }}
            />
            {error ? <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
            <TouchableOpacity
              onPress={handleLookup}
              disabled={loading}
              style={{
                backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="search" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Find Club</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={{
              backgroundColor: '#13131C', borderRadius: 14, padding: 16, marginBottom: 24,
              borderWidth: 1, borderColor: '#1E1E2E',
            }}>
              <Text style={{ color: '#9F67FF', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>FOUND</Text>
              <Text style={{ color: '#E8E8F0', fontSize: 18, fontWeight: '700' }}>{clubInfo?.name}</Text>
              <Text style={{ color: '#6B6B85', fontSize: 13, marginTop: 4 }}>
                🔒 This club requires a PIN
              </Text>
            </View>

            <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Enter PIN
            </Text>
            <TextInput
              value={pin}
              onChangeText={(t) => { setPin(t); setError(''); }}
              placeholder="Club PIN"
              placeholderTextColor="#6B6B85"
              secureTextEntry
              style={{
                backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 16,
                paddingVertical: 14, color: '#E8E8F0', fontSize: 16, fontWeight: '600',
                borderWidth: 1, borderColor: error ? '#EF4444' : '#1E1E2E', marginBottom: 24,
              }}
            />
            {error ? <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleJoinWithPin}
              disabled={loading}
              style={{
                backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                marginBottom: 12,
              }}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="enter" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Join Club</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setRequiresPin(false); setPin(''); setError(''); }}>
              <Text style={{ color: '#6B6B85', textAlign: 'center', fontSize: 14 }}>← Change Club ID</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
